import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing watchlist ID" },
        { status: 400 }
      );
    }

    await db.execute(
      "DELETE FROM watchlist WHERE id = ?",
      [parseInt(id)]
    );

    return NextResponse.json({ message: "Stock removed from watchlist" });
  } catch (error) {
    console.error("Watchlist delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove stock" },
      { status: 500 }
    );
  }
}
