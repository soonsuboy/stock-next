import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { ensureCompanySectorColumns } from "@/lib/company-sector-schema";
import { ensureMetricsPriceColumns } from "@/lib/metrics-price-schema";
import { ensureTeacherWatchlist } from "@/lib/teacher-watchlist";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await ensureCompanySectorColumns();
    await ensureMetricsPriceColumns();
    await ensureTeacherWatchlist();

    const result = await db.execute(
      `WITH latest AS (
         SELECT code, country, MAX(snapshot_date) AS snapshot_date
         FROM metrics_history
         GROUP BY code, country
       )
       SELECT
         tw.id,
         tw.code,
         tw.country,
         tw.display_name,
         tw.market AS fallback_market,
         tw.currency AS fallback_currency,
         tw.gics_sector AS fallback_sector,
         tw.note,
         tw.sort_order,
         COALESCE(c.name, tw.display_name) AS name,
         COALESCE(c.market, tw.market) AS market,
         COALESCE(c.currency, tw.currency) AS currency,
         COALESCE(c.gics_sector, tw.gics_sector) AS gics_sector,
         c.industry_name,
         m.close_price AS price,
         m.previous_close,
         m.change_rate,
         m.market_cap,
         m.shares_outstanding,
         m.equity,
         m.net_income,
         m.operating_income,
         m.total_liabilities,
         m.roe,
         m.pbr,
         m.per,
         m.debt_ratio,
         m.created_at AS collected_at
       FROM teacher_watchlist tw
       LEFT JOIN companies c
         ON c.code = tw.code AND c.country = tw.country
       LEFT JOIN latest l
         ON l.code = tw.code AND l.country = tw.country
       LEFT JOIN metrics_history m
         ON m.code = l.code
        AND m.country = l.country
        AND m.snapshot_date = l.snapshot_date
       WHERE tw.active = 1
       ORDER BY tw.sort_order`
    );

    const stocks = result.rows.map((row) => {
      const country = String(row.country);

      return {
        id: Number(row.id),
        code: String(row.code),
        country,
        display_name: String(row.display_name),
        name: String(row.name),
        market: typeof row.market === "string" ? row.market : "",
        currency: typeof row.currency === "string" ? row.currency : null,
        gics_sector:
          typeof row.gics_sector === "string" ? row.gics_sector : null,
        industry_name:
          typeof row.industry_name === "string" ? row.industry_name : null,
        note: typeof row.note === "string" ? row.note : null,
        sort_order: Number(row.sort_order),
        price_collectable: country === "KR" || country === "US",
        price: typeof row.price === "number" ? row.price : null,
        previous_close:
          typeof row.previous_close === "number" ? row.previous_close : null,
        change_rate:
          typeof row.change_rate === "number" ? row.change_rate : null,
        market_cap:
          typeof row.market_cap === "number" ? row.market_cap : null,
        shares_outstanding:
          typeof row.shares_outstanding === "number"
            ? row.shares_outstanding
            : null,
        equity: typeof row.equity === "number" ? row.equity : null,
        net_income:
          typeof row.net_income === "number" ? row.net_income : null,
        operating_income:
          typeof row.operating_income === "number"
            ? row.operating_income
            : null,
        total_liabilities:
          typeof row.total_liabilities === "number"
            ? row.total_liabilities
            : null,
        roe: typeof row.roe === "number" ? row.roe : null,
        pbr: typeof row.pbr === "number" ? row.pbr : null,
        per: typeof row.per === "number" ? row.per : null,
        debt_ratio:
          typeof row.debt_ratio === "number" ? row.debt_ratio : null,
        collected_at:
          typeof row.collected_at === "string" ? row.collected_at : null,
      };
    });

    return NextResponse.json({ stocks });
  } catch (error) {
    console.error("Teacher watchlist fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch teacher watchlist" },
      { status: 500 }
    );
  }
}
