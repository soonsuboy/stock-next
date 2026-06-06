import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import {
  createAssetGroup,
  deleteAssetGroup,
  getAssetData,
  updateAssetGroup,
} from "@/lib/assets";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    await createAssetGroup(user.id, payload.name, payload.memberIds);
    const data = await getAssetData(user.id);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Asset group create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create group" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const groupId = typeof payload.id === "string" ? payload.id : "";
    if (!groupId) {
      return NextResponse.json({ error: "Missing group id" }, { status: 400 });
    }

    await updateAssetGroup(user.id, groupId, payload.name, payload.memberIds);
    const data = await getAssetData(user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Asset group update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update group" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const groupId = request.nextUrl.searchParams.get("id");
    if (!groupId) {
      return NextResponse.json({ error: "Missing group id" }, { status: 400 });
    }

    await deleteAssetGroup(user.id, groupId);
    const data = await getAssetData(user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Asset group delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete group" },
      { status: 400 }
    );
  }
}
