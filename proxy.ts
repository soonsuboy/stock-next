export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/login",
    "/search/:path*",
    "/watchlist/:path*",
    "/analysis/:path*",
    "/admin/:path*",
  ],
};
