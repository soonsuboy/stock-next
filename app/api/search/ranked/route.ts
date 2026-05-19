import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { ensureCompanySectorColumns } from "@/lib/company-sector-schema";
import { ensureMetricsPriceColumns } from "@/lib/metrics-price-schema";

type SortKey = "market_cap" | "roe" | "per" | "pbr" | "price";
type FilterKey = "all" | "limit_up" | "limit_down";
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

function parseFilter(value: string | null): FilterKey {
  if (value === "limit_up" || value === "limit_down") return value;
  return "all";
}

function parseCountry(value: string | null): Country {
  return value === "US" ? "US" : "KR";
}

function parseLimit(value: string | null) {
  const limit = Number(value || 30);
  if (!Number.isInteger(limit)) return 30;
  return Math.max(1, Math.min(100, limit));
}

function parsePage(value: string | null) {
  const page = Number(value || 1);
  if (!Number.isInteger(page)) return 1;
  return Math.max(1, page);
}

async function loadRanked(
  country: Country,
  sort: SortKey,
  filter: FilterKey,
  limit: number,
  page: number
) {
  const sortRule = sortColumns[sort];
  const filterSql =
    filter === "limit_up"
      ? "AND m.change_rate >= 28"
      : filter === "limit_down"
        ? "AND m.change_rate <= -28"
        : "";
  const orderSql =
    filter === "limit_up"
      ? "m.change_rate DESC, c.name"
      : filter === "limit_down"
        ? "m.change_rate ASC, c.name"
        : `${sortRule.column} ${sortRule.direction}, c.name`;
  const requiredColumn = filter === "all" ? sortRule.column : "m.change_rate";
  const whereSql = `m.country = ?
            AND m.snapshot_date = (
              SELECT MAX(m2.snapshot_date)
              FROM metrics_history m2
              WHERE m2.code = m.code AND m2.country = m.country
            )
            AND ${requiredColumn} IS NOT NULL
            ${filterSql}`;
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) AS total
          FROM metrics_history m
          JOIN companies c
            ON c.code = m.code AND c.country = m.country
          WHERE ${whereSql}`,
    args: [country],
  });
  const total = Number(countResult.rows[0]?.total || 0);
  const offset = (page - 1) * limit;
  const result = await db.execute({
    sql: `SELECT
            c.code,
            c.name,
            c.market,
            c.country,
            c.gics_sector,
            m.close_price AS price,
            m.previous_close,
            m.change_rate,
            m.market_cap,
            m.equity,
            m.net_income,
            m.roe,
            m.per,
            m.pbr,
            m.created_at AS collected_at
          FROM metrics_history m
          JOIN companies c
            ON c.code = m.code AND c.country = m.country
          WHERE ${whereSql}
          ORDER BY ${orderSql}
          LIMIT ? OFFSET ?`,
    args: [country, limit, offset],
  });

  return {
    total,
    rows: result.rows.map((row) => ({
      code: String(row.code),
      name: String(row.name),
      market: typeof row.market === "string" ? row.market : "",
      country: String(row.country),
      gics_sector: typeof row.gics_sector === "string" ? row.gics_sector : null,
      price: typeof row.price === "number" ? row.price : null,
      previous_close:
        typeof row.previous_close === "number" ? row.previous_close : null,
      change_rate: typeof row.change_rate === "number" ? row.change_rate : null,
      market_cap: typeof row.market_cap === "number" ? row.market_cap : null,
      equity: typeof row.equity === "number" ? row.equity : null,
      net_income: typeof row.net_income === "number" ? row.net_income : null,
      roe: typeof row.roe === "number" ? row.roe : null,
      per: typeof row.per === "number" ? row.per : null,
      pbr: typeof row.pbr === "number" ? row.pbr : null,
      collected_at:
        typeof row.collected_at === "string" ? row.collected_at : null,
    })),
  };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const sort = parseSort(request.nextUrl.searchParams.get("sort"));
  const filter = parseFilter(request.nextUrl.searchParams.get("filter"));
  const country = parseCountry(request.nextUrl.searchParams.get("country"));
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const page = parsePage(request.nextUrl.searchParams.get("page"));

  try {
    await ensureCompanySectorColumns();
    await ensureMetricsPriceColumns();
    const { rows, total } = await loadRanked(country, sort, filter, limit, page);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      sort,
      filter,
      country,
      page,
      limit,
      total,
      totalPages,
      results: rows,
    });
  } catch (error) {
    console.error("Ranked metrics fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ranked metrics" },
      { status: 500 }
    );
  }
}
