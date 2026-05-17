import Link from "next/link";
import { redirect } from "next/navigation";
import AdminDashboard from "@/app/admin/AdminDashboard";
import { isAdminConfigured, isAdminEmail } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  if (!isAdminEmail(currentUser.email)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          관리자 권한이 필요합니다
        </h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Vercel 프로덕션에서는 환경변수{" "}
          <span className="font-mono font-semibold">ADMIN_EMAILS</span>에
          관리자 Google 이메일을 등록해야 합니다.
        </p>
        {!isAdminConfigured() && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            현재 관리자 이메일이 설정되어 있지 않습니다. 예:{" "}
            <span className="font-mono">ADMIN_EMAILS=name@example.com</span>
          </div>
        )}
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
        >
          홈으로 이동
        </Link>
      </div>
    );
  }

  return <AdminDashboard initialStatus={null} />;
}
