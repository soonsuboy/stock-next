import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // watchlist의 모든 종목과 최신 financials 데이터 조인
    const result = await db.execute(
      `SELECT 
        w.code, 
        w.name, 
        w.country,
        f.market_cap,
        f.equity,
        f.net_income,
        f.roe, 
        f.pbr, 
        f.per
       FROM watchlist w
       LEFT JOIN (
         SELECT code, MAX(collected_at) as latest_date FROM financials GROUP BY code
       ) latest ON w.code = latest.code
       LEFT JOIN financials f ON w.code = f.code AND f.collected_at = latest.latest_date
       ORDER BY w.added_at DESC`
    );

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
