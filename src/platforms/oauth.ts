import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { isRecord } from "../db/json.js";

const YOUTUBE_PLATFORM = "youtube";
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_CHANNELS_URL =
  "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";
const DEFAULT_DASHBOARD_APP_URL = "http://localhost:3001";
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

export interface PlatformOAuthProvider {
  platform: "youtube";
  enabled: boolean;
  authorizationUrl: string;
  scope: string;
}

export interface PlatformOAuthConfigStatus {
  enabled: boolean;
  missing: string[];
}

export interface PlatformOAuthStateInput {
  creatorId: string;
  privyUserId: string;
  platform: "youtube";
}

interface PlatformOAuthStatePayload extends PlatformOAuthStateInput {
  issuedAt: number;
  nonce: string;
}

interface DecodedPlatformOAuthStatePayload {
  creatorId: string;
  privyUserId: string;
  platform: string;
  issuedAt: number;
  nonce: string;
}

export interface VerifiedPlatformOAuthState extends PlatformOAuthStatePayload {}

export interface VerifyPlatformOAuthStateInput {
  platform: "youtube";
  state: string;
  now?: Date;
  maxAgeSeconds?: number;
}

export interface ExchangeYouTubeOAuthCodeResult {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  expiresAt: string | null;
  scope: string | null;
  tokenType: string | null;
}

export interface YouTubeChannelIdentity {
  channelId: string;
  title: string;
  handle: string | null;
}

export interface BuildPlatformOAuthRedirectInput {
  platform: string;
  status: "success" | "error";
  error?: string;
}

function getEnv(name: keyof NodeJS.ProcessEnv): string {
  return process.env[name]?.trim() ?? "";
}

function isDecodedPlatformOAuthStatePayload(
  value: unknown,
): value is DecodedPlatformOAuthStatePayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.creatorId === "string" &&
    typeof value.privyUserId === "string" &&
    typeof value.platform === "string" &&
    typeof value.issuedAt === "number" &&
    Number.isFinite(value.issuedAt) &&
    typeof value.nonce === "string"
  );
}

function deriveStateSigningKey(): Buffer {
  const secret = getEnv("PRIVY_APP_SECRET");

  if (!secret) {
    throw new Error("PRIVY_APP_SECRET is required for platform OAuth state");
  }

  return createHash("sha256").update(secret).digest();
}

function signStatePayload(payload: string): string {
  return createHmac("sha256", deriveStateSigningKey())
    .update(payload)
    .digest("base64url");
}

function assertYouTubePlatform(
  platform: string,
): asserts platform is "youtube" {
  if (platform !== YOUTUBE_PLATFORM) {
    throw new Error(`Unsupported OAuth platform: ${platform}`);
  }
}

function getYouTubeOAuthConfig() {
  return {
    clientId: getEnv("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: getEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    redirectUri: getEnv("YOUTUBE_OAUTH_REDIRECT_URI"),
  };
}

export function getYouTubeOAuthConfigStatus(): PlatformOAuthConfigStatus {
  const { clientId, clientSecret, redirectUri } = getYouTubeOAuthConfig();
  const missing: string[] = [];

  if (!clientId) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!redirectUri) missing.push("YOUTUBE_OAUTH_REDIRECT_URI");

  return {
    enabled: missing.length === 0,
    missing,
  };
}

function assertYouTubeOAuthConfigured() {
  const status = getYouTubeOAuthConfigStatus();
  const { clientId, clientSecret, redirectUri } = getYouTubeOAuthConfig();

  if (!status.enabled) {
    const error = new Error("YouTube OAuth is not configured");
    (error as Error & { missing?: string[] }).missing = status.missing;
    throw error;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

function getDashboardAppUrl(): string {
  return getEnv("DASHBOARD_APP_URL") || DEFAULT_DASHBOARD_APP_URL;
}

export function getPlatformOAuthProviders(): PlatformOAuthProvider[] {
  const status = getYouTubeOAuthConfigStatus();

  return [
    {
      platform: YOUTUBE_PLATFORM,
      enabled: status.enabled,
      authorizationUrl: GOOGLE_AUTH_URL,
      scope: YOUTUBE_SCOPE,
    },
  ];
}

export function createPlatformOAuthState(
  input: PlatformOAuthStateInput,
): string {
  assertYouTubePlatform(input.platform);

  const payload = Buffer.from(
    JSON.stringify({
      ...input,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomBytes(16).toString("base64url"),
    } satisfies PlatformOAuthStatePayload),
  ).toString("base64url");

  return `${payload}.${signStatePayload(payload)}`;
}

export function verifyPlatformOAuthState(
  input: VerifyPlatformOAuthStateInput,
): VerifiedPlatformOAuthState {
  assertYouTubePlatform(input.platform);

  const segments = input.state.split(".");
  if (segments.length !== 2) {
    throw new Error("Invalid OAuth state format");
  }
  const [payload, signature] = segments;
  if (!payload || !signature) {
    throw new Error("Invalid OAuth state format");
  }

  const expectedSignature = signStatePayload(payload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Invalid OAuth state signature");
  }

  let parsed: DecodedPlatformOAuthStatePayload;

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (!isDecodedPlatformOAuthStatePayload(decoded)) {
      throw new Error("Invalid OAuth state payload");
    }
    parsed = decoded;
  } catch {
    throw new Error("Invalid OAuth state payload");
  }

  if (parsed.platform !== input.platform) {
    throw new Error("OAuth state platform mismatch");
  }

  const now = input.now ?? new Date();
  const maxAgeSeconds = input.maxAgeSeconds ?? OAUTH_STATE_MAX_AGE_SECONDS;
  if (Math.floor(now.getTime() / 1000) - parsed.issuedAt > maxAgeSeconds) {
    throw new Error("OAuth state has expired");
  }

  return { ...parsed, platform: input.platform };
}

export function buildPlatformOAuthUrl(input: PlatformOAuthStateInput): string {
  assertYouTubePlatform(input.platform);

  const { clientId, redirectUri } = assertYouTubeOAuthConfigured();

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", createPlatformOAuthState(input));

  return url.toString();
}

export async function exchangeYouTubeOAuthCode(
  code: string,
): Promise<ExchangeYouTubeOAuthCodeResult> {
  const { clientId, clientSecret, redirectUri } =
    assertYouTubeOAuthConfigured();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `YouTube OAuth token exchange failed with status ${response.status}`,
    );
  }

  const data: unknown = await response.json();

  if (
    !isRecord(data) ||
    typeof data.access_token !== "string" ||
    data.access_token.length === 0
  ) {
    throw new Error(
      "YouTube OAuth token exchange did not return an access token",
    );
  }

  const expiresIn =
    typeof data.expires_in === "number" ? data.expires_in : null;

  return {
    accessToken: data.access_token,
    refreshToken:
      typeof data.refresh_token === "string" ? data.refresh_token : null,
    expiresIn,
    expiresAt: expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null,
    scope: typeof data.scope === "string" ? data.scope : null,
    tokenType: typeof data.token_type === "string" ? data.token_type : null,
  };
}

export async function fetchYouTubeChannelIdentity(
  accessToken: string,
): Promise<YouTubeChannelIdentity> {
  const response = await fetch(YOUTUBE_CHANNELS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `YouTube channel lookup failed with status ${response.status}`,
    );
  }

  const data: unknown = await response.json();
  const items = isRecord(data) && Array.isArray(data.items) ? data.items : [];
  const channel = items[0];
  const snippet =
    isRecord(channel) && isRecord(channel.snippet)
      ? channel.snippet
      : undefined;
  if (
    !isRecord(channel) ||
    typeof channel.id !== "string" ||
    !snippet ||
    typeof snippet.title !== "string"
  ) {
    throw new Error("YouTube channel lookup did not return a channel identity");
  }

  return {
    channelId: channel.id,
    title: snippet.title,
    handle: typeof snippet.customUrl === "string" ? snippet.customUrl : null,
  };
}

export function buildPlatformOAuthRedirect(
  input: BuildPlatformOAuthRedirectInput,
): string {
  const url = new URL("/dashboard/settings", getDashboardAppUrl());
  url.searchParams.set("oauth", input.status);
  url.searchParams.set("platform", input.platform);

  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url.toString();
}
