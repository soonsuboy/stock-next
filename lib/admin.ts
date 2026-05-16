import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
}

function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;

  const emails = configuredAdminEmails();
  if (emails.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  return emails.includes(email.trim().toLowerCase());
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  if (!isAdminEmail(user.email)) {
    return {
      user: null,
      response: NextResponse.json(
        {
          error:
            "Admin access required. Set ADMIN_EMAILS in the deployment environment.",
        },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

export function isAdminConfigured() {
  return configuredAdminEmails().length > 0;
}
