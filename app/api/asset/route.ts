import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import {
  deleteAssetSnapshot,
  isValidYearMonth,
  listAssetSnapshots,
  parseAssetSnapshotInput,
  upsertAssetSnapshot,
} from "@/lib/assets";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const snapshots = await listAssetSnapshots(user.id);
    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error("Asset snapshots fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset snapshots" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const snapshot = parseAssetSnapshotInput(payload);

    if (!snapshot) {
      return NextResponse.json(
        { error: "Invalid asset snapshot payload" },
        { status: 400 }
      );
    }

    await upsertAssetSnapshot(user.id, snapshot);
    const snapshots = await listAssetSnapshots(user.id);

    return NextResponse.json({ snapshots }, { status: 201 });
  } catch (error) {
    console.error("Asset snapshot save error:", error);
    return NextResponse.json(
      { error: "Failed to save asset snapshot" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const yearMonth = request.nextUrl.searchParams.get("yearMonth");
    if (!isValidYearMonth(yearMonth)) {
      return NextResponse.json(
        { error: "Invalid yearMonth parameter" },
        { status: 400 }
      );
    }

    await deleteAssetSnapshot(user.id, yearMonth);
    const snapshots = await listAssetSnapshots(user.id);

    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error("Asset snapshot delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete asset snapshot" },
      { status: 500 }
    );
  }
}
