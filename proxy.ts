export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/login",
    "/search/:path*",
    "/watchlist/:path*",
    "/asset/:path*",
    "/teacher-watchlist/:path*",
    "/analysis/:path*",
    "/discussions/:path*",
    "/misc/:path*",
    "/mypage/:path*",
    "/admin/:path*",
  ],
};
