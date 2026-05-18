import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { ensureAppUsersTable, isAppUserActive } from "@/lib/app-users";
import { isOAuthProviderConfigured } from "@/lib/oauth";

interface AppUserUpsert {
  id: string;
  provider: string;
  providerAccountId: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function upsertAppUser(user: AppUserUpsert) {
  await ensureAppUsersTable();
  await db.execute({
    sql: `INSERT INTO app_users
          (id, provider, provider_account_id, name, email, image, active,
           last_login_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                  CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            image = excluded.image,
            last_login_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP`,
    args: [
      user.id,
      user.provider,
      user.providerAccountId,
      user.name,
      user.email,
      user.image,
    ],
  });
}

const providers: NextAuthConfig["providers"] = [];

if (isOAuthProviderConfigured("google")) {
  providers.push(Google);
}

const config = {
  secret:
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "production"
      ? undefined
      : "local-development-auth-secret-do-not-use-in-production"),
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers,
  callbacks: {
    async jwt({ token, account, user, profile }) {
      if (account?.provider && account.providerAccountId) {
        const provider = account.provider;
        const providerAccountId = account.providerAccountId;
        const appUserId = `${provider}:${providerAccountId}`;
        const profileData = profile as Record<string, unknown> | undefined;

        token.userId = appUserId;
        token.provider = provider;
        token.providerAccountId = providerAccountId;

        try {
          await upsertAppUser({
            id: appUserId,
            provider,
            providerAccountId,
            name: stringOrNull(user?.name) ?? stringOrNull(token.name),
            email: stringOrNull(user?.email) ?? stringOrNull(token.email),
            image:
              stringOrNull(user?.image) ??
              stringOrNull(token.picture) ??
              stringOrNull(profileData?.picture) ??
              stringOrNull(profileData?.profile_image),
          });
        } catch (error) {
          console.error("App user upsert failed:", error);
        }
      }

      if (typeof token.userId === "string") {
        try {
          token.userActive = await isAppUserActive(token.userId);
        } catch (error) {
          console.error("App user active check failed:", error);
          token.userActive = token.userActive ?? true;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") {
        session.user.id = token.userId;
        session.user.provider =
          typeof token.provider === "string" ? token.provider : undefined;
        session.user.providerAccountId =
          typeof token.providerAccountId === "string"
            ? token.providerAccountId
            : undefined;
        session.user.active = token.userActive !== false;
      }

      return session;
    },
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const hasActiveSession = Boolean(
        auth?.user?.id && auth.user.active !== false
      );
      const isProtectedPage =
        pathname.startsWith("/search") ||
        pathname.startsWith("/watchlist") ||
        pathname.startsWith("/analysis") ||
        pathname.startsWith("/discussions") ||
        pathname.startsWith("/mypage") ||
        pathname.startsWith("/admin");

      if (isProtectedPage) {
        return hasActiveSession;
      }

      if (pathname === "/login" && hasActiveSession) {
        return Response.redirect(new URL("/watchlist", request.nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);
