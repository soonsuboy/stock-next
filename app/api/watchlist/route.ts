import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { ensureCompanySectorColumns } from "@/lib/company-sector-schema";
import { inferGicsSector, normalizeGicsSector } from "@/lib/gics-sector";
import { getSectorGuides, normalizeSectorName } from "@/lib/sector-guides";

function normalizeCode(code: string, country: string) {
  const trimmed = code.trim();
  return country === "KR" ? trimmed.padStart(6, "0") : trimmed.toUpperCase();
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await ensureCompanySectorColumns();
    const sectorGuides = await getSectorGuides();
    const result = await db.execute({
      sql: `SELECT
              uw.id,
              c.code,
              c.name,
              c.country,
              c.market,
              c.gics_sector,
              c.industry_name,
              c.sector_source,
              uw.added_at,
              m.close_price AS price,
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

    const stocks = result.rows.map((row) => {
      const gicsSector =
        normalizeSectorName(row.gics_sector) ||
        normalizeGicsSector(row.gics_sector) ||
        inferGicsSector({
          code: typeof row.code === "string" ? row.code : String(row.code),
          country:
            typeof row.country === "string" ? row.country : String(row.country),
          name: typeof row.name === "string" ? row.name : String(row.name),
          market: typeof row.market === "string" ? row.market : "",
          industryName:
            typeof row.industry_name === "string" ? row.industry_name : "",
        });

      return {
        id: row.id,
        code: row.code,
        name: row.name,
        country: row.country,
        market: row.market,
        gics_sector: gicsSector,
        industry_name: row.industry_name,
        sector_source: row.sector_source,
        added_at: row.added_at,
        price: row.price,
        market_cap: row.market_cap,
        shares_outstanding: row.shares_outstanding,
        equity: row.equity,
        net_income: row.net_income,
        operating_income: row.operating_income,
        total_liabilities: row.total_liabilities,
        roe: row.roe,
        pbr: row.pbr,
        per: row.per,
        debt_ratio: row.debt_ratio,
        collected_at: row.collected_at,
      };
    });

    return NextResponse.json({ stocks, sectors: sectorGuides });
  } catch (error) {
    console.error("Watchlist fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await ensureCompanySectorColumns();
    const { code, country } = (await request.json()) as {
      code?: string;
      country?: string;
    };

    if (!code || !country || !["KR", "US"].includes(country)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const normalizedCode = normalizeCode(code, country);
    const company = await db.execute({
      sql: "SELECT code, country FROM companies WHERE code = ? AND country = ?",
      args: [normalizedCode, country],
    });

    if (company.rows.length === 0) {
      return NextResponse.json(
        { error: "Company is not available in the local database" },
        { status: 404 }
      );
    }

    const existing = await db.execute({
      sql: `SELECT id FROM user_watchlist
            WHERE user_id = ? AND code = ? AND country = ?`,
      args: [user.id, normalizedCode, country],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Stock already in watchlist" },
        { status: 409 }
      );
    }

    await db.execute({
      sql: `INSERT INTO user_watchlist
            (user_id, code, country, added_at, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [user.id, normalizedCode, country],
    });

    return NextResponse.json(
      { message: "Stock added to watchlist" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Watchlist add error:", error);
    return NextResponse.json(
      { error: "Failed to add stock" },
      { status: 500 }
    );
  }
}
