import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";

type SortKey = "market_cap" | "roe" | "per" | "pbr" | "price";
type Country = "KR" | "US";

const sortColumns: Record<SortKey, { column: string; direction: "ASC" | "DESC" }> = {
  market_cap: { column: "m.market_cap", direction: "DESC" },
  roe: { column: "m.roe", direction: "DESC" },
  per: { column: "m.per", direction: "ASC" },
  pbr: { column: "m.pbr", direction: "ASC" },
  price: { column: "m.close_price", direction: "DESC" },
};

function parseSort(value: string | null): SortKey {
  if (
    value === "roe" ||
    value === "per" ||
    value === "pbr" ||
    value === "price"
  ) {
    return value;
  }
  return "market_cap";
}

function parseLimit(value: string | null) {
  const limit = Number(value || 30);
  if (!Number.isInteger(limit)) return 30;
  return Math.max(5, Math.min(100, limit));
}

async function loadRanked(country: Country, sort: SortKey, limit: number) {
  const sortRule = sortColumns[sort];
  const result = await db.execute({
    sql: `WITH latest AS (
            SELECT code, country, MAX(snapshot_date) AS snapshot_date
            FROM metrics_history
            WHERE country = ?
            GROUP BY code, country
          )
          SELECT
            c.code,
            c.name,
            c.market,
            c.country,
            m.close_price AS price,
            m.market_cap,
            m.equity,
            m.net_income,
            m.roe,
            m.per,
            m.pbr,
            m.created_at AS collected_at
          FROM latest l
          JOIN metrics_history m
            ON m.code = l.code
           AND m.country = l.country
           AND m.snapshot_date = l.snapshot_date
          JOIN companies c
            ON c.code = m.code AND c.country = m.country
          WHERE ${sortRule.column} IS NOT NULL
          ORDER BY ${sortRule.column} ${sortRule.direction}, c.name
          LIMIT ?`,
    args: [country, limit],
  });

  return result.rows.map((row) => ({
    code: String(row.code),
    name: String(row.name),
    market: typeof row.market === "string" ? row.market : "",
    country: String(row.country),
    price: typeof row.price === "number" ? row.price : null,
    market_cap: typeof row.market_cap === "number" ? row.market_cap : null,
    equity: typeof row.equity === "number" ? row.equity : null,
    net_income: typeof row.net_income === "number" ? row.net_income : null,
    roe: typeof row.roe === "number" ? row.roe : null,
    per: typeof row.per === "number" ? row.per : null,
    pbr: typeof row.pbr === "number" ? row.pbr : null,
    collected_at:
      typeof row.collected_at === "string" ? row.collected_at : null,
  }));
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const sort = parseSort(request.nextUrl.searchParams.get("sort"));
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const [kr, us] = await Promise.all([
      loadRanked("KR", sort, limit),
      loadRanked("US", sort, limit),
    ]);

    return NextResponse.json({ sort, limit, results: { KR: kr, US: us } });
  } catch (error) {
    console.error("Ranked metrics fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ranked metrics" },
      { status: 500 }
    );
  }
}
