export const oauthProviders = [
  {
    id: "google",
    label: "Google",
    idEnv: "AUTH_GOOGLE_ID",
    secretEnv: "AUTH_GOOGLE_SECRET",
    callbackPath: "/api/auth/callback/google",
  },
  {
    id: "kakao",
    label: "Kakao",
    idEnv: "AUTH_KAKAO_ID",
    secretEnv: "AUTH_KAKAO_SECRET",
    callbackPath: "/api/auth/callback/kakao",
  },
] as const;

export type OAuthProviderId = (typeof oauthProviders)[number]["id"];

function hasValue(name: string) {
  return Boolean(process.env[name]?.trim());
}

function normalizeBaseUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function getOAuthBaseUrls() {
  const urls = [
    process.env.AUTH_URL || "http://localhost:3000",
    ...(process.env.AUTH_ADDITIONAL_URLS || "")
      .split(",")
      .map((url) => url.trim()),
    process.env.VERCEL_PROJECT_PRODUCTION_URL || "",
    process.env.VERCEL_URL || "",
  ]
    .map((url) => normalizeBaseUrl(url))
    .filter((url): url is string => Boolean(url));

  return Array.from(new Set(urls));
}

export function isOAuthProviderConfigured(id: OAuthProviderId) {
  const provider = oauthProviders.find((item) => item.id === id);
  if (!provider) return false;
  return hasValue(provider.idEnv) && hasValue(provider.secretEnv);
}

export function getOAuthSetupStatus() {
  const baseUrls = getOAuthBaseUrls();

  return oauthProviders.map((provider) => {
    const missingKeys = [provider.idEnv, provider.secretEnv].filter(
      (key) => !hasValue(key)
    );

    return {
      ...provider,
      configured: missingKeys.length === 0,
      missingKeys,
      callbackUrls: baseUrls.map((url) => `${url}${provider.callbackPath}`),
      javascriptOrigins: baseUrls,
    };
  });
}
