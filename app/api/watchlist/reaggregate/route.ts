import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { dispatchStockBatchWorkflow } from "@/lib/github-actions";
import { getBatchSettings } from "@/lib/batch-settings";

type Country = "KR" | "US";

interface WatchlistMetricTarget {
  code: string;
  country: Country;
  name: string;
  collectedAt: string | null;
}

function getWatchlistBatchMaxCodes() {
  const value = Number(process.env.WATCHLIST_BATCH_MAX_CODES || 100);
  if (!Number.isFinite(value) || value < 1) return 100;
  return Math.min(Math.floor(value), 500);
}

function isCountry(value: unknown): value is Country {
  return value === "KR" || value === "US";
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

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const maxCodes = getWatchlistBatchMaxCodes();
  const settings = await getBatchSettings();
  const skipRecentHours = settings.watchlistSkipRecentHours;

  try {
    const result = await db.execute({
      sql: `WITH latest AS (
              SELECT code, country, MAX(snapshot_date) AS snapshot_date
              FROM metrics_history
              GROUP BY code, country
            )
            SELECT
              c.code,
              c.country,
              c.name,
              m.created_at AS collected_at
            FROM user_watchlist uw
            JOIN companies c
              ON uw.code = c.code AND uw.country = c.country
            LEFT JOIN latest l
              ON c.code = l.code AND c.country = l.country
            LEFT JOIN metrics_history m
              ON m.code = l.code
             AND m.country = l.country
             AND m.snapshot_date = l.snapshot_date
            WHERE uw.user_id = ?
            ORDER BY c.country, uw.added_at DESC`,
      args: [user.id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "관심종목이 없습니다." },
        { status: 400 }
      );
    }

    const targets: WatchlistMetricTarget[] = result.rows
      .filter((row) => isCountry(row.country) && typeof row.code === "string")
      .map((row) => ({
        code: String(row.code),
        country: row.country as Country,
        name: typeof row.name === "string" ? row.name : String(row.code),
        collectedAt:
          typeof row.collected_at === "string" ? row.collected_at : null,
      }));

    const skippedRecent = targets.filter((target) =>
      isRecentlyCollected(target.collectedAt, skipRecentHours)
    );
    const staleTargets = targets.filter(
      (target) => !isRecentlyCollected(target.collectedAt, skipRecentHours)
    );

    if (staleTargets.length === 0) {
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

    if (staleTargets.length > maxCodes) {
      return NextResponse.json(
        {
          error: `${skipRecentHours}시간 이내 집계된 기업을 제외해도 재집계 대상이 ${staleTargets.length}개입니다. 한 번에 최대 ${maxCodes}개까지 요청할 수 있습니다.`,
        },
        { status: 400 }
      );
    }

    const codesByCountry: Record<Country, string[]> = {
      KR: [],
      US: [],
    };

    for (const target of staleTargets) {
      codesByCountry[target.country].push(target.code);
    }

    const dispatched: Array<{
      country: Country;
      count: number;
      codes: string[];
    }> = [];

    for (const country of ["KR", "US"] as const) {
      const codes = codesByCountry[country];
      if (codes.length === 0) continue;

      const dispatch = await dispatchStockBatchWorkflow({
        mode: country.toLowerCase() as "kr" | "us",
        codes: codes.join(","),
        selection: "all",
      });

      if (!dispatch.ok) {
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
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Watchlist batch workflow dispatched",
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
