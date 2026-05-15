import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Financial statement updates now run in the scheduled batch pipeline. Vercel function collection is disabled.",
    },
    { status: 410 }
  );
}
