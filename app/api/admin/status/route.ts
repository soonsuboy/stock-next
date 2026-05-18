import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import {
  getAdminBatchStatus,
  type AdminStatusSection,
} from "@/lib/admin-data";

const validSections = new Set(["summary", "coverage", "runs", "all"]);

export async function GET(request: NextRequest) {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    const sectionParam = request.nextUrl.searchParams.get("section") || "summary";
    const section = (
      validSections.has(sectionParam) ? sectionParam : "summary"
    ) as AdminStatusSection;
    const status = await getAdminBatchStatus(section);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Admin batch status error:", error);
    return NextResponse.json(
      { error: "Failed to load admin batch status" },
      { status: 500 }
    );
  }
}
