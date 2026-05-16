import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getAdminBatchStatus } from "@/lib/admin-data";

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    const status = await getAdminBatchStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("Admin batch status error:", error);
    return NextResponse.json(
      { error: "Failed to load admin batch status" },
      { status: 500 }
    );
  }
}
