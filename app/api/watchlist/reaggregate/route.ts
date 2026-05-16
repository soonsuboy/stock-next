import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { dispatchStockBatchWorkflow } from "@/lib/github-actions";

type Country = "KR" | "US";

function getWatchlistBatchMaxCodes() {
  const value = Number(process.env.WATCHLIST_BATCH_MAX_CODES || 100);
  if (!Number.isFinite(value) || value < 1) return 100;
  return Math.min(Math.floor(value), 500);
}

function isCountry(value: unknown): value is Country {
  return value === "KR" || value === "US";
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const maxCodes = getWatchlistBatchMaxCodes();

  try {
    const result = await db.execute({
      sql: `SELECT c.code, c.country
            FROM user_watchlist uw
            JOIN companies c
              ON uw.code = c.code AND uw.country = c.country
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

    if (result.rows.length > maxCodes) {
      return NextResponse.json(
        {
          error: `관심종목 재집계는 한 번에 최대 ${maxCodes}개까지 요청할 수 있습니다.`,
        },
        { status: 400 }
      );
    }

    const codesByCountry: Record<Country, string[]> = {
      KR: [],
      US: [],
    };

    for (const row of result.rows) {
      if (isCountry(row.country) && typeof row.code === "string") {
        codesByCountry[row.country].push(row.code);
      }
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
        total: result.rows.length,
        dispatched,
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
