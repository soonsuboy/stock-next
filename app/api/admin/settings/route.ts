import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getBatchSettings, saveBatchSettings } from "@/lib/batch-settings";

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    return NextResponse.json({ settings: await getBatchSettings() });
  } catch (error) {
    console.error("Admin settings fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load batch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    const body = await request.json();
    return NextResponse.json({ settings: await saveBatchSettings(body) });
  } catch (error) {
    console.error("Admin settings save error:", error);
    return NextResponse.json(
      { error: "Failed to save batch settings" },
      { status: 500 }
    );
  }
}
