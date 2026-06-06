import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/auth";
import { getOAuthSetupStatus, type OAuthProviderId } from "@/lib/oauth";
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

const supportedProviders = ["google", "kakao", "naver"] as const;

const socialButtonConfigs: Record<
  OAuthProviderId,
  { label: string; className: string }
> = {
  google: {
    label: "Google로 계속하기",
    className:
      "border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800",
  },
  kakao: {
    label: "카카오로 계속하기",
    className: "border-[#FEE500] bg-[#FEE500] text-slate-950 hover:bg-[#f7dc00]",
  },
  naver: {
    label: "네이버로 계속하기",
    className: "border-[#03C75A] bg-[#03C75A] text-white hover:bg-[#02b351]",
  },
};

function isSupportedProvider(value: FormDataEntryValue | null): value is OAuthProviderId {
  return (
    typeof value === "string" &&
    supportedProviders.includes(value as OAuthProviderId)
  );
}

function SocialLogo({ provider }: { provider: OAuthProviderId }) {
  if (provider === "google") {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
      >
        <path
          d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.29h6.47c-.28 1.5-1.12 2.77-2.4 3.62v3h3.88c2.27-2.09 3.54-5.17 3.54-8.64z"
          fill="#4285F4"
        />
        <path
          d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.09A12 12 0 0 0 12 24z"
          fill="#34A853"
        />
        <path
          d="M5.27 14.29A7.22 7.22 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.62H1.26A12 12 0 0 0 0 12c0 1.93.46 3.76 1.26 5.38l4.01-3.09z"
          fill="#FBBC05"
        />
        <path
          d="M12 4.76c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.53 11.53 0 0 0 12 0 12 12 0 0 0 1.26 6.62l4.01 3.09C6.22 6.87 8.87 4.76 12 4.76z"
          fill="#EA4335"
        />
      </svg>
    );
  }

  if (provider === "kakao") {
    return (
      <span
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[11px] font-black text-[#FEE500]"
      >
        K
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white text-[13px] font-black text-[#03C75A]"
    >
      N
    </span>
  );
}

async function signInWithProvider(formData: FormData) {
  "use server";
  const provider = formData.get("provider");
  if (!isSupportedProvider(provider)) return;

  const callbackUrl = formData.get("callbackUrl");
  await signIn(provider, {
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
          {setupStatus.map((provider) => {
            const config = socialButtonConfigs[provider.id];

            return (
              <form key={provider.id} action={signInWithProvider}>
                <input type="hidden" name="provider" value={provider.id} />
                <input
                  type="hidden"
                  name="callbackUrl"
                  value={safeCallbackUrl(params?.callbackUrl)}
                />
                <button
                  type="submit"
                  disabled={!provider.configured}
                  className={`flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${config.className}`}
                >
                  <SocialLogo provider={provider.id} />
                  <span>{config.label}</span>
                </button>
              </form>
            );
          })}
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
