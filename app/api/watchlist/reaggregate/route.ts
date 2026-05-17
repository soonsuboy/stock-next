import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import {
  createBatchRunRequest,
  markBatchRunRequestFailed,
} from "@/lib/batch-run-log";
import { dispatchStockBatchWorkflow } from "@/lib/github-actions";
import { getBatchSettings } from "@/lib/batch-settings";

type Country = "KR" | "US";

interface WatchlistMetricTarget {
  code: string;
  country: Country;
  name: string;
  watchlistId: number;
  collectedAt: string | null;
  equity: number | null;
  netIncome: number | null;
}

function getWatchlistBatchMaxCodes() {
  const value = Number(process.env.WATCHLIST_BATCH_MAX_CODES || 100);
  if (!Number.isFinite(value) || value < 1) return 100;
  return Math.min(Math.floor(value), 500);
}

function isCountry(value: unknown): value is Country {
  return value === "KR" || value === "US";
}

function normalizeCode(code: string, country: Country) {
  const trimmed = code.trim();
  return country === "KR" ? trimmed.padStart(6, "0") : trimmed.toUpperCase();
}

function parseCollectedAt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isRecentlyCollected(value: unknown, skipRecentHours: number) {
  if (skipRecentHours <= 0) return false;

  const timestamp = parseCollectedAt(value);
  if (timestamp === null) return false;
  return Date.now() - timestamp <= skipRecentHours * 60 * 60 * 1000;
}

async function readManualTarget(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: unknown;
      code?: unknown;
      country?: unknown;
    };
    const id = Number(body.id || 0);
    const country = isCountry(body.country) ? body.country : null;
    const code =
      typeof body.code === "string" && country
        ? normalizeCode(body.code, country)
        : "";
    return {
      id: Number.isInteger(id) && id > 0 ? id : null,
      code,
      country,
    };
  } catch {
    return { id: null, code: "", country: null };
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const maxCodes = getWatchlistBatchMaxCodes();
  const settings = await getBatchSettings();
  const skipRecentHours = settings.watchlistSkipRecentHours;
  const manualTarget = await readManualTarget(request);
  const isManualSingleTarget = Boolean(
    manualTarget.id || (manualTarget.code && manualTarget.country)
  );

  try {
    const where = ["uw.user_id = ?"];
    const args: Array<string | number> = [user.id];
    if (manualTarget.id) {
      where.push("uw.id = ?");
      args.push(manualTarget.id);
    } else if (manualTarget.code && manualTarget.country) {
      where.push("uw.code = ? AND uw.country = ?");
      args.push(manualTarget.code, manualTarget.country);
    }

    const result = await db.execute({
      sql: `WITH latest AS (
              SELECT code, country, MAX(snapshot_date) AS snapshot_date
              FROM metrics_history
              GROUP BY code, country
            )
            SELECT
              uw.id AS watchlist_id,
              c.code,
              c.country,
              c.name,
              m.created_at AS collected_at,
              m.equity,
              m.net_income
            FROM user_watchlist uw
            JOIN companies c
              ON uw.code = c.code AND uw.country = c.country
            LEFT JOIN latest l
              ON c.code = l.code AND c.country = l.country
            LEFT JOIN metrics_history m
              ON m.code = l.code
             AND m.country = l.country
             AND m.snapshot_date = l.snapshot_date
            WHERE ${where.join(" AND ")}
            ORDER BY c.country, uw.added_at DESC`,
      args,
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          error: isManualSingleTarget
            ? "해당 관심종목을 찾을 수 없습니다."
            : "관심종목이 없습니다.",
        },
        { status: isManualSingleTarget ? 404 : 400 }
      );
    }

    const targets: WatchlistMetricTarget[] = result.rows
      .filter((row) => isCountry(row.country) && typeof row.code === "string")
      .map((row) => ({
        code: String(row.code),
        country: row.country as Country,
        name: typeof row.name === "string" ? row.name : String(row.code),
        watchlistId: Number(row.watchlist_id),
        collectedAt:
          typeof row.collected_at === "string" ? row.collected_at : null,
        equity: typeof row.equity === "number" ? row.equity : null,
        netIncome: typeof row.net_income === "number" ? row.net_income : null,
      }));

    const hasCoreGaps = (target: WatchlistMetricTarget) =>
      target.equity === null || target.netIncome === null;
    const skippedRecent = targets.filter((target) =>
      isRecentlyCollected(target.collectedAt, skipRecentHours) && !hasCoreGaps(target)
    );
    const staleTargets = targets.filter(
      (target) =>
        !isRecentlyCollected(target.collectedAt, skipRecentHours) ||
        hasCoreGaps(target)
    );
    const dispatchTargets = isManualSingleTarget ? targets : staleTargets;

    if (dispatchTargets.length === 0) {
      return NextResponse.json({
        ok: true,
        message: `All watchlist companies were collected within ${skipRecentHours} hours`,
        total: targets.length,
        dispatched: [],
        skippedRecent: skippedRecent.map((target) => ({
          code: target.code,
          country: target.country,
          name: target.name,
          collectedAt: target.collectedAt,
        })),
        skippedRecentCount: skippedRecent.length,
        skipRecentHours,
      });
    }

    if (dispatchTargets.length > maxCodes) {
      return NextResponse.json(
        {
          error: `${skipRecentHours}시간 이내 집계된 기업을 제외해도 재집계 대상이 ${dispatchTargets.length}개입니다. 한 번에 최대 ${maxCodes}개까지 요청할 수 있습니다.`,
        },
        { status: 400 }
      );
    }

    const codesByCountry: Record<Country, string[]> = {
      KR: [],
      US: [],
    };

    for (const target of dispatchTargets) {
      codesByCountry[target.country].push(target.code);
    }

    const dispatched: Array<{
      country: Country;
      count: number;
      codes: string[];
      requestId: string;
    }> = [];

    for (const country of ["KR", "US"] as const) {
      const codes = codesByCountry[country];
      if (codes.length === 0) continue;

      const requestId = randomUUID();
      await createBatchRunRequest({
        id: requestId,
        jobName: "update_metrics",
        market: country,
        message: isManualSingleTarget
          ? `watchlist manual collect requested codes=${codes.length} including latest quote`
          : `watchlist reaggregate requested codes=${codes.length}`,
      });

      const dispatch = await dispatchStockBatchWorkflow({
        mode: country.toLowerCase() as "kr" | "us",
        codes: codes.join(","),
        selection: "all",
        requestId,
      });

      if (!dispatch.ok) {
        await markBatchRunRequestFailed(requestId, `${dispatch.error}\n${dispatch.details}`);
        return NextResponse.json(
          {
            error: dispatch.error,
            status: dispatch.status,
            details: dispatch.details,
            dispatched,
          },
          { status: dispatch.status === 503 ? 503 : 502 }
        );
      }

      dispatched.push({
        country,
        count: codes.length,
        codes,
        requestId,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: isManualSingleTarget
          ? "Watchlist single company batch workflow dispatched"
          : "Watchlist batch workflow dispatched",
        manual: isManualSingleTarget,
        total: targets.length,
        dispatched,
        skippedRecent: skippedRecent.map((target) => ({
          code: target.code,
          country: target.country,
          name: target.name,
          collectedAt: target.collectedAt,
        })),
        skippedRecentCount: skippedRecent.length,
        skipRecentHours,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Watchlist reaggregate error:", error);
    return NextResponse.json(
      { error: "관심종목 재집계 요청 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
