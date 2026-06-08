import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createVcard, getVcardFileName, kidaCard } from "@/lib/vcard";
import { recordVcardScan } from "@/lib/vcard-db";

export const runtime = "nodejs";

function hashIp(value: string | null) {
  if (!value) {
    return null;
  }
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (slug !== kidaCard.slug && slug !== `${kidaCard.slug}.vcf`) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const platform = request.nextUrl.searchParams.get("platform") || "unknown";
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip");

  await recordVcardScan({
    cardId: kidaCard.id,
    platform: platform === "ios" || platform === "android" || platform === "web" ? platform : "unknown",
    userAgent: request.headers.get("user-agent"),
    ipHash: hashIp(ip),
  });

  return new NextResponse(createVcard(kidaCard), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(getVcardFileName(kidaCard))}`,
      "Cache-Control": "no-store",
    },
  });
}
