import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const result = await db.execute({
      sql: `WITH latest AS (
              SELECT code, country, MAX(snapshot_date) AS snapshot_date
              FROM metrics_history
              GROUP BY code, country
            )
            SELECT
              c.code,
              c.name,
              c.country,
              m.market_cap,
              m.equity,
              m.net_income,
              m.roe,
              m.pbr,
              m.per
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
            ORDER BY uw.added_at DESC`,
      args: [user.id],
    });

    const stocks = result.rows.map((row) => ({
      code: row.code,
      name: row.name,
      country: row.country,
      market_cap: row.market_cap,
      equity: row.equity,
      net_income: row.net_income,
      roe: row.roe,
      pbr: row.pbr,
      per: row.per,
    }));

    return NextResponse.json({ stocks });
  } catch (error) {
    console.error("Analysis data fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis data" },
      { status: 500 }
    );
  }
}
