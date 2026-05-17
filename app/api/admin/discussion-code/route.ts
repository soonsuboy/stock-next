import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import {
  createDiscussionAccessCode,
  isDiscussionAccessCodeConfigured,
  listDiscussionAccessCodes,
  setDiscussionAccessCodeActive,
} from "@/lib/discussion-access";

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  return NextResponse.json({
    configured: await isDiscussionAccessCodeConfigured(),
    codes: await listDiscussionAccessCodes(),
  });
}

export async function POST(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  let body: { label?: unknown; code?: unknown; durationDays?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const label = typeof body.label === "string" ? body.label : "";
  const durationDays = Number(body.durationDays || 0);
  if (code.trim() && code.trim().length < 4) {
    return NextResponse.json(
      { error: "접근 코드는 4자 이상으로 설정하세요." },
      { status: 400 }
    );
  }
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
    return NextResponse.json(
      { error: "기간은 1일부터 3650일 사이로 설정하세요." },
      { status: 400 }
    );
  }

  try {
    const codes = await createDiscussionAccessCode({
      label,
      code,
      durationDays,
    });
    return NextResponse.json({
      configured: codes.some((item) => item.active),
      codes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "종목토론조회 코드 저장 실패",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  let body: { id?: unknown; active?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1 || typeof body.active !== "boolean") {
    return NextResponse.json(
      { error: "id와 active 값을 확인하세요." },
      { status: 400 }
    );
  }

  const codes = await setDiscussionAccessCodeActive(id, body.active);
  return NextResponse.json({
    configured: codes.some((item) => item.active),
    codes,
  });
}
