export const oauthProviders = [
  {
    id: "google",
    label: "Google",
    idEnv: "AUTH_GOOGLE_ID",
    secretEnv: "AUTH_GOOGLE_SECRET",
    idEnvAliases: [],
    secretEnvAliases: [],
    callbackPath: "/api/auth/callback/google",
  },
  {
    id: "kakao",
    label: "Kakao",
    idEnv: "AUTH_KAKAO_ID",
    secretEnv: "AUTH_KAKAO_SECRET",
    idEnvAliases: ["KAKAO_CLIENT_ID", "KAKAO_REST_API_KEY"],
    secretEnvAliases: ["KAKAO_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/kakao",
  },
  {
    id: "naver",
    label: "Naver",
    idEnv: "AUTH_NAVER_ID",
    secretEnv: "AUTH_NAVER_SECRET",
    idEnvAliases: ["NAVER_CLIENT_ID"],
    secretEnvAliases: ["NAVER_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/naver",
  },
] as const;

export type OAuthProviderId = (typeof oauthProviders)[number]["id"];

function firstEnvValue(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
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
  const idValue = firstEnvValue([provider.idEnv, ...provider.idEnvAliases]);
  const secretValue = firstEnvValue([
    provider.secretEnv,
    ...provider.secretEnvAliases,
  ]);
  return Boolean(idValue && secretValue);
}

export function getOAuthProviderClientConfig(id: OAuthProviderId) {
  const provider = oauthProviders.find((item) => item.id === id);
  if (!provider) return null;
  const clientId = firstEnvValue([provider.idEnv, ...provider.idEnvAliases]);
  const clientSecret = firstEnvValue([
    provider.secretEnv,
    ...provider.secretEnvAliases,
  ]);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function getOAuthSetupStatus() {
  const baseUrls = getOAuthBaseUrls();

  return oauthProviders.map((provider) => {
    const rawMissingKeys: Array<string | null> = [
      firstEnvValue([provider.idEnv, ...provider.idEnvAliases])
        ? null
        : provider.idEnv,
      firstEnvValue([provider.secretEnv, ...provider.secretEnvAliases])
        ? null
        : provider.secretEnv,
    ];
    const missingKeys = rawMissingKeys.filter(
      (key): key is string => Boolean(key)
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
