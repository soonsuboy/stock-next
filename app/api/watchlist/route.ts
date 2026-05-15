import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const result = await db.execute(
      `SELECT
         w.id,
         w.code,
         w.name,
         w.country,
         w.market,
         w.added_at,
         f.price,
         f.market_cap,
         f.equity,
         f.net_income,
         f.operating_income,
         f.total_liabilities,
         f.roe,
         f.pbr,
         f.per,
         f.debt_ratio,
         f.collected_at
       FROM watchlist w
       LEFT JOIN (
         SELECT code, MAX(collected_at) as latest_date FROM financials GROUP BY code
       ) latest ON w.code = latest.code
       LEFT JOIN financials f ON w.code = f.code AND f.collected_at = latest.latest_date
       ORDER BY w.added_at DESC`
    );

    const stocks = result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      country: row.country,
      market: row.market,
      added_at: row.added_at,
      price: row.price,
      market_cap: row.market_cap,
      equity: row.equity,
      net_income: row.net_income,
      operating_income: row.operating_income,
      total_liabilities: row.total_liabilities,
      roe: row.roe,
      pbr: row.pbr,
      per: row.per,
      debt_ratio: row.debt_ratio,
      collected_at: row.collected_at,
    }));

    return NextResponse.json({ stocks });
  } catch (error) {
    console.error("Watchlist fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { code, name, country, market } = await request.json();

    if (!code || !name || !country) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 이미 존재하는 경우 무시
    const existing = await db.execute(
      "SELECT id FROM watchlist WHERE code = ?",
      [code]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Stock already in watchlist" },
        { status: 409 }
      );
    }

    await db.execute(
      `INSERT INTO watchlist (code, name, country, market, added_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [code, name, country, market || ""]
    );

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
