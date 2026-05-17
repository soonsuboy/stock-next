import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import {
  isDiscussionAccessCodeConfigured,
  setDiscussionAccessCode,
} from "@/lib/discussion-access";

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  return NextResponse.json({
    configured: await isDiscussionAccessCodeConfigured(),
  });
}

export async function PATCH(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  if (code.trim() && code.trim().length < 4) {
    return NextResponse.json(
      { error: "접근 코드는 4자 이상으로 설정하세요." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    configured: await setDiscussionAccessCode(code),
  });
}
