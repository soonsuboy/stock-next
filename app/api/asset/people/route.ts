import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import {
  createAssetPerson,
  deleteAssetPerson,
  getAssetData,
} from "@/lib/assets";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    await createAssetPerson(user.id, payload.name);
    const data = await getAssetData(user.id);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Asset person create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create person" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const personId = request.nextUrl.searchParams.get("id");
    if (!personId) {
      return NextResponse.json({ error: "Missing person id" }, { status: 400 });
    }

    await deleteAssetPerson(user.id, personId);
    const data = await getAssetData(user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Asset person delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete person" },
      { status: 400 }
    );
  }
}
