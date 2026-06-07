import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json({
    isAdmin: isAdminEmail(user?.email),
  });
}
