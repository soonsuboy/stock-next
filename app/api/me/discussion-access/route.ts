import { NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import {
  getDiscussionAccessStatus,
  grantDiscussionAccess,
  verifyDiscussionAccessCode,
} from "@/lib/discussion-access";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  return NextResponse.json(await getDiscussionAccessStatus(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const valid = await verifyDiscussionAccessCode(code);
  if (!valid) {
    return NextResponse.json(
      { error: "종목토론조회 코드가 올바르지 않습니다." },
      { status: 403 }
    );
  }

  await grantDiscussionAccess(user.id);
  return NextResponse.json(await getDiscussionAccessStatus(user.id));
}
