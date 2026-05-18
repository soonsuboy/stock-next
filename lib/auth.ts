import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function getCurrentUser() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  if (session.user.active === false) {
    return null;
  }

  return {
    id: userId,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    provider: session.user.provider,
  };
}

export function unauthorized() {
  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401 }
  );
}
