import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import NavigationProgress from "@/app/NavigationProgress";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "투자지표 분석 - Stock Analysis",
  description: "한국·미국 상장사 투자지표 분석 플랫폼",
};

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const isAdmin = isAdminEmail(session?.user?.email);

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-950">
        <NavigationProgress />
        {/* Navigation Header */}
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40">
          <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-slate-900 dark:text-white">
              📈 Stock Analysis
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                홈
              </Link>
              <Link href="/search" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                종목 검색
              </Link>
              <Link href="/watchlist" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                관심 종목
              </Link>
              <Link href="/analysis" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                분석
              </Link>
              {session?.user?.id && (
                <Link href="/discussions" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                  종목 토론
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                  관리자
                </Link>
              )}
              {session?.user?.id ? (
                <>
                  <Link href="/mypage" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                    마이페이지
                  </Link>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                      로그아웃
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                  로그인
                </Link>
              )}
            </div>
          </nav>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-6 mt-12">
          <div className="max-w-6xl mx-auto px-6 text-center text-sm text-slate-600 dark:text-slate-400">
            <p>© 2026 Stock Analysis. Batch-collected DART & SEC data.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
