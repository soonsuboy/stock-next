import { NextRequest, NextResponse } from "next/server";
import { kidaCard } from "@/lib/vcard";
import { createBusinessCardExchange } from "@/lib/vcard-db";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = clean(body.name);
  const email = clean(body.email);
  const phone = clean(body.phone);

  if (!name || (!email && !phone)) {
    return NextResponse.json(
      { error: "이름과 이메일 또는 휴대폰 번호가 필요합니다." },
      { status: 400 },
    );
  }

  await createBusinessCardExchange({
    ownerCardId: kidaCard.id,
    name,
    organization: clean(body.organization) || null,
    title: clean(body.title) || null,
    email: email || null,
    phone: phone || null,
    note: clean(body.note) || null,
  });

  return NextResponse.json({ ok: true });
}
