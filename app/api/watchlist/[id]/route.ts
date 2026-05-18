import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { ensureCompanySectorColumns } from "@/lib/company-sector-schema";
import { getActiveSectorNames, normalizeSectorName } from "@/lib/sector-guides";

function parseWatchlistId(value: string) {
  const watchlistId = Number(value);
  return Number.isInteger(watchlistId) && watchlistId > 0 ? watchlistId : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await ensureCompanySectorColumns();
    const { id } = await params;
    const watchlistId = parseWatchlistId(id);

    if (!watchlistId) {
      return NextResponse.json(
        { error: "Missing watchlist ID" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      gicsSector?: unknown;
      gics_sector?: unknown;
      sector?: unknown;
    };
    const nextSector = normalizeSectorName(
      body.gicsSector ?? body.gics_sector ?? body.sector
    );

    if (!nextSector) {
      return NextResponse.json(
        { error: "GICS 11대 섹터 중 하나를 선택하세요." },
        { status: 400 }
      );
    }

    const activeSectorNames = await getActiveSectorNames();
    if (!activeSectorNames.has(nextSector)) {
      return NextResponse.json(
        { error: "관리자에 등록된 사용 가능 섹터 중 하나를 선택하세요." },
        { status: 400 }
      );
    }

    const target = await db.execute({
      sql: `SELECT uw.code, uw.country
            FROM user_watchlist uw
            JOIN companies c
              ON uw.code = c.code AND uw.country = c.country
            WHERE uw.id = ? AND uw.user_id = ?
            LIMIT 1`,
      args: [watchlistId, user.id],
    });

    if (target.rows.length === 0) {
      return NextResponse.json(
        { error: "Watchlist stock not found" },
        { status: 404 }
      );
    }

    const row = target.rows[0];
    const code = String(row.code);
    const country = String(row.country);

    await db.execute({
      sql: `UPDATE companies
            SET gics_sector = ?, sector_source = ?
            WHERE code = ? AND country = ?`,
      args: [nextSector, "user_manual", code, country],
    });

    return NextResponse.json({
      message: "Sector updated",
      gics_sector: nextSector,
      sector_source: "user_manual",
    });
  } catch (error) {
    console.error("Watchlist sector update error:", error);
    return NextResponse.json(
      { error: "Failed to update sector" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const watchlistId = parseWatchlistId(id);

    if (!watchlistId) {
      return NextResponse.json(
        { error: "Missing watchlist ID" },
        { status: 400 }
      );
    }

    await db.execute({
      sql: "DELETE FROM user_watchlist WHERE id = ? AND user_id = ?",
      args: [watchlistId, user.id],
    });

    return NextResponse.json({ message: "Stock removed from watchlist" });
  } catch (error) {
    console.error("Watchlist delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove stock" },
      { status: 500 }
    );
  }
}
