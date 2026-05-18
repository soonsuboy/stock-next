import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import {
  getSectorGuides,
  normalizeSectorName,
  saveSectorGuide,
  type SectorGuideInput,
} from "@/lib/sector-guides";

function parseSectorPayload(body: Record<string, unknown>): SectorGuideInput {
  const name = normalizeSectorName(body.name);
  if (!name) {
    throw new Error("섹터명을 입력하세요.");
  }

  return {
    originalName:
      typeof body.originalName === "string" ? body.originalName : undefined,
    name,
    guidePer: typeof body.guidePer === "string" ? body.guidePer.trim() : "",
    guidePbr: typeof body.guidePbr === "string" ? body.guidePbr.trim() : "",
    guideRoe: typeof body.guideRoe === "string" ? body.guideRoe.trim() : "",
    summary: typeof body.summary === "string" ? body.summary.trim() : "",
    sortOrder: Number(body.sortOrder || 999),
    active: body.active !== false,
  };
}

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    return NextResponse.json({
      sectors: await getSectorGuides({ includeInactive: true }),
    });
  } catch (error) {
    console.error("Admin sectors fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load sector guides" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    const input = parseSectorPayload((await request.json()) as Record<string, unknown>);
    await saveSectorGuide(input);
    return NextResponse.json({
      sectors: await getSectorGuides({ includeInactive: true }),
    });
  } catch (error) {
    console.error("Admin sectors create error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create sector guide",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    const input = parseSectorPayload((await request.json()) as Record<string, unknown>);
    await saveSectorGuide(input);
    return NextResponse.json({
      sectors: await getSectorGuides({ includeInactive: true }),
    });
  } catch (error) {
    console.error("Admin sectors update error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update sector guide",
      },
      { status: 400 }
    );
  }
}
