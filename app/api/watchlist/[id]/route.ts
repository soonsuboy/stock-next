import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const watchlistId = Number(id);

    if (!Number.isInteger(watchlistId) || watchlistId <= 0) {
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
