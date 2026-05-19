import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { ensureCompanySectorColumns } from "@/lib/company-sector-schema";
import { buildCompanyProfile } from "@/lib/company-profile";
import {
  buildInvestmentInsights,
  type InsightStockInput,
} from "@/lib/investment-insights";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await ensureCompanySectorColumns();
    const result = await db.execute({
      sql: `SELECT
              c.code,
              c.name,
              c.country,
              c.market,
              c.gics_sector,
              c.industry_name,
              m.market_cap,
              m.equity,
              m.net_income,
              m.operating_income,
              m.total_liabilities,
              m.debt_ratio,
              m.roe,
              m.pbr,
              m.per
            FROM user_watchlist uw
            JOIN companies c
              ON uw.code = c.code AND uw.country = c.country
            LEFT JOIN metrics_history m
              ON m.code = c.code
             AND m.country = c.country
             AND m.snapshot_date = (
               SELECT MAX(m2.snapshot_date)
               FROM metrics_history m2
               WHERE m2.code = c.code AND m2.country = c.country
             )
            WHERE uw.user_id = ?
            ORDER BY uw.added_at DESC`,
      args: [user.id],
    });

    const stocks = result.rows.map((row) => ({
      code: row.code,
      name: row.name,
      country: row.country,
      market: row.market,
      gics_sector: row.gics_sector,
      industry_name: row.industry_name,
      profile: buildCompanyProfile({
        code: String(row.code),
        country: String(row.country),
        name: String(row.name),
        market: typeof row.market === "string" ? row.market : null,
        gicsSector:
          typeof row.gics_sector === "string" ? row.gics_sector : null,
        industryName:
          typeof row.industry_name === "string" ? row.industry_name : null,
      }),
      market_cap: row.market_cap,
      equity: row.equity,
      net_income: row.net_income,
      operating_income: row.operating_income,
      total_liabilities: row.total_liabilities,
      debt_ratio: row.debt_ratio,
      roe: row.roe,
      pbr: row.pbr,
      per: row.per,
    }));

    const insightInputs: InsightStockInput[] = stocks.map((stock) => ({
      code: String(stock.code),
      country: String(stock.country),
      gics_sector:
        typeof stock.gics_sector === "string" ? stock.gics_sector : null,
      per: typeof stock.per === "number" ? stock.per : null,
      pbr: typeof stock.pbr === "number" ? stock.pbr : null,
      roe: typeof stock.roe === "number" ? stock.roe : null,
      equity: typeof stock.equity === "number" ? stock.equity : null,
      net_income:
        typeof stock.net_income === "number" ? stock.net_income : null,
      operating_income:
        typeof stock.operating_income === "number"
          ? stock.operating_income
          : null,
      debt_ratio:
        typeof stock.debt_ratio === "number" ? stock.debt_ratio : null,
    }));
    const insightsByStock = await buildInvestmentInsights(insightInputs);
    const enrichedStocks = stocks.map((stock) => ({
      ...stock,
      insights: insightsByStock.get(`${stock.country}:${stock.code}`) || null,
    }));

    return NextResponse.json({ stocks: enrichedStocks });
  } catch (error) {
    console.error("Analysis data fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis data" },
      { status: 500 }
    );
  }
}
