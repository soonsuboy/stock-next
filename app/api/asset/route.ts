import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import {
  deleteAssetSnapshot,
  getAssetData,
  isValidYearMonth,
  parseAssetSnapshotInput,
  upsertAssetSnapshot,
} from "@/lib/assets";

export async function GET() {
  const { user, response } = await requireAdminApi();
  if (response) return response;

  try {
    const data = await getAssetData(user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Asset snapshots fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset snapshots" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAdminApi();
  if (response) return response;

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
    const data = await getAssetData(user.id);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Asset snapshot save error:", error);
    return NextResponse.json(
      { error: "Failed to save asset snapshot" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { user, response } = await requireAdminApi();
  if (response) return response;

  try {
    const personId = request.nextUrl.searchParams.get("personId");
    const yearMonth = request.nextUrl.searchParams.get("yearMonth");
    if (!personId || !isValidYearMonth(yearMonth)) {
      return NextResponse.json(
        { error: "Invalid personId or yearMonth parameter" },
        { status: 400 }
      );
    }

    await deleteAssetSnapshot(user.id, personId, yearMonth);
    const data = await getAssetData(user.id);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Asset snapshot delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete asset snapshot" },
      { status: 500 }
    );
  }
}
