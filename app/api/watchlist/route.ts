import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const result = await db.execute(
      `SELECT id, code, name, country, market, added_at 
       FROM watchlist 
       ORDER BY added_at DESC`
    );

    const stocks = result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      country: row.country,
      market: row.market,
      added_at: row.added_at,
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
