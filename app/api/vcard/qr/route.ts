import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createMeCard, kidaCard } from "@/lib/vcard";

export const runtime = "nodejs";

function getOrigin(request: NextRequest) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (configured?.startsWith("http")) {
    return configured.replace(/\/$/, "");
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");
  const origin = getOrigin(request);
  const payload =
    platform === "android"
      ? createMeCard(kidaCard)
      : `${origin}/api/vcard/contact/${kidaCard.slug}.vcf?platform=ios`;

  const svg = await QRCode.toString(payload, {
    type: "svg",
    color: {
      dark: platform === "android" ? "#1a4d45" : "#0f1f3d",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
