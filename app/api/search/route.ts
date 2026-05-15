import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";

interface Stock {
  code: string;
  name: string;
  market: string;
  country: string;
  price?: number | null;
  marcap?: number | null;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const q = (request.nextUrl.searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 }
    );
  }

  try {
    const startsWith = `${q}%`;
    const contains = `%${q}%`;

    const result = await db.execute({
      sql: `WITH latest AS (
              SELECT code, country, MAX(snapshot_date) AS snapshot_date
              FROM metrics_history
              GROUP BY code, country
            )
            SELECT
              c.code,
              c.name,
              c.market,
              c.country,
              m.close_price AS price,
              m.market_cap AS marcap
            FROM companies c
            LEFT JOIN latest l
              ON c.code = l.code AND c.country = l.country
            LEFT JOIN metrics_history m
              ON m.code = l.code
             AND m.country = l.country
             AND m.snapshot_date = l.snapshot_date
            WHERE c.code LIKE ? OR c.name LIKE ?
            ORDER BY
              CASE
                WHEN UPPER(c.code) = UPPER(?) THEN 0
                WHEN UPPER(c.code) LIKE UPPER(?) THEN 1
                WHEN c.name LIKE ? THEN 2
                ELSE 3
              END,
              CASE c.country WHEN 'KR' THEN 0 ELSE 1 END,
              c.name
            LIMIT 30`,
      args: [contains, contains, q, startsWith, startsWith],
    });

    const results: Stock[] = result.rows.map((row) => ({
      code: String(row.code),
      name: String(row.name),
      market: typeof row.market === "string" ? row.market : "",
      country: String(row.country),
      price: typeof row.price === "number" ? row.price : null,
      marcap: typeof row.marcap === "number" ? row.marcap : null,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("DB search error:", error);
    return NextResponse.json(
      { error: "Failed to search companies" },
      { status: 500 }
    );
  }
}
