import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/auth";
import { getOAuthSetupStatus } from "@/lib/oauth";
import { redirect } from "next/navigation";

function safeCallbackUrl(value: string | undefined) {
  if (!value) return "/watchlist";
  try {
    const url = new URL(value, "http://localhost");
    if (!["http:", "https:"].includes(url.protocol)) return "/watchlist";
    if (!url.pathname.startsWith("/")) return "/watchlist";
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith("/") ? value : "/watchlist";
  }
}

async function signInWithGoogle(formData: FormData) {
  "use server";
  const callbackUrl = formData.get("callbackUrl");
  await signIn("google", {
    redirectTo: safeCallbackUrl(
      typeof callbackUrl === "string" ? callbackUrl : undefined
    ),
  });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const currentUser = await getCurrentUser();
  const setupStatus = getOAuthSetupStatus();
  const params = await searchParams;

  if (currentUser) {
    redirect("/watchlist");
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">
          로그인
        </h1>
        <p className="mb-8 text-sm text-slate-600 dark:text-slate-400">
          종목 검색, 관심 종목, 분석 화면은 로그인 후 사용할 수 있습니다.
        </p>

        {params?.error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            OAuth 설정을 확인해야 합니다. 아래 콜백 URL과 환경변수를 맞춘 뒤
            개발 서버를 재시작해주세요.
          </div>
        )}

        <div className="space-y-3">
          <form action={signInWithGoogle}>
            <input
              type="hidden"
              name="callbackUrl"
              value={safeCallbackUrl(params?.callbackUrl)}
            />
            <button
              type="submit"
              disabled={!setupStatus.find((item) => item.id === "google")?.configured}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
            >
              Google로 계속하기
            </button>
          </form>
        </div>

        {setupStatus.some((item) => !item.configured) && (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left text-xs text-amber-950">
            <p className="mb-3 font-semibold">로컬 OAuth 설정이 필요합니다.</p>
            <div className="space-y-3">
              {setupStatus.map((provider) => (
                <div key={provider.id}>
                  <p className="font-semibold">{provider.label}</p>
                  <p className="mt-1 font-semibold">승인된 JavaScript 원본</p>
                  <ul className="list-inside list-disc space-y-1">
                    {provider.javascriptOrigins.map((origin) => (
                      <li key={origin} className="break-all font-mono">
                        {origin}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-semibold">승인된 리디렉션 URI</p>
                  <ul className="list-inside list-disc space-y-1">
                    {provider.callbackUrls.map((callbackUrl) => (
                      <li key={callbackUrl} className="break-all font-mono">
                        {callbackUrl}
                      </li>
                    ))}
                  </ul>
                  {provider.missingKeys.length > 0 && (
                    <p className="mt-2">
                      누락 환경변수:{" "}
                      <span className="font-mono">
                        {provider.missingKeys.join(", ")}
                      </span>
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-amber-900">
              `.env.local`에 값을 넣은 뒤 개발 서버를 재시작하면 버튼이
              활성화됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
