import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { McpConfig } from "./config";
import { exchangeCode, fetchGoogleUser, googleAuthUrl } from "./google";

// ── Minimal HS256 JWT (no dependency) ──────────────────────────

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function b64urlJson(obj: unknown): string {
  return b64url(JSON.stringify(obj));
}

export function signJwt(payload: Record<string, unknown>, secret: string, expiresInSec: number): string {
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlJson({ ...payload, iat: now, exp: now + expiresInSec });
  const head = b64urlJson({ alg: "HS256", typ: "JWT" });
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function verifyJwt(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts as [string, string, string];
  const want = createHmac("sha256", secret).update(`${head}.${body}`).digest();
  let got: Buffer;
  try {
    got = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
  const exp = payload.exp;
  if (typeof exp !== "number" || exp * 1000 < Date.now()) return null;
  return payload;
}

/** PKCE S256 challenge for a verifier (plain SHA-256, base64url). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

export const AUTH_CODE_TTL_SEC = 10 * 60;
export const ACCESS_TOKEN_TTL_SEC = 12 * 60 * 60;
export const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;

/** Redirect URIs we accept from OAuth clients (editors use loopback). */
export function isAllowedRedirectUri(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return true;
  if (uri === "https://vscode.dev/redirect") return true;
  return false;
}

export interface DcrRequest {
  redirect_uris?: unknown;
  client_name?: unknown;
}

export function handleRegister(body: DcrRequest): { status: number; json: unknown } {
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || !uris.every((u) => typeof u === "string" && isAllowedRedirectUri(u))) {
    return {
      status: 400,
      json: { error: "invalid_redirect_uri", error_description: "register a loopback (http://127.0.0.1:*) or https://vscode.dev/redirect URI" },
    };
  }
  return {
    status: 201,
    json: {
      client_id: `trell_${randomBytes(12).toString("hex")}`,
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
  };
}

export interface AuthorizeParams {
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  response_type?: string;
}

/**
 * Start login: validate the client's request, stash it in a signed state
 * token and bounce to Google. Returns { redirect } or { error }.
 */
export function beginAuthorize(
  config: McpConfig,
  params: AuthorizeParams,
): { redirect?: string; status?: number; text?: string } {
  if (!config.googleClientId || !config.googleClientSecret || !config.oauthSecret) {
    return { status: 503, text: "Google login is not configured on this MCP server" };
  }
  const { client_id, redirect_uri, code_challenge, code_challenge_method, state, response_type } = params;
  if (response_type !== "code") return { status: 400, text: "response_type must be code" };
  if (!client_id || !redirect_uri || !isAllowedRedirectUri(redirect_uri)) {
    return { status: 400, text: "invalid redirect_uri" };
  }
  if (!code_challenge || code_challenge_method !== "S256") {
    return { status: 400, text: "code_challenge with S256 is required" };
  }
  const st = signJwt(
    { type: "oauth_state", client_id, redirect_uri, code_challenge, client_state: state ?? null, nonce: randomBytes(8).toString("hex") },
    config.oauthSecret,
    AUTH_CODE_TTL_SEC,
  );
  const url = googleAuthUrl(
    {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      redirectUri: `${config.publicUrl}/oauth/callback`,
    },
    st,
  );
  return { redirect: url };
}

export interface GoogleDeps {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchFn?: typeof fetch;
}

function googleDeps(config: McpConfig, fetchFn?: typeof fetch): GoogleDeps {
  return {
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    redirectUri: `${config.publicUrl}/oauth/callback`,
    ...(fetchFn ? { fetchFn } : {}),
  };
}

function oauthError(redirectUri: string, clientState: string | null, error: string): { redirect: string } {
  const q = new URLSearchParams({ error });
  if (clientState) q.set("state", clientState);
  return { redirect: `${redirectUri}?${q.toString()}` };
}

/**
 * Google redirected back (?code&state). Validate, resolve the Google user,
 * mint our auth code and bounce to the editor. Google I/O injectable for tests.
 */
export async function handleCallback(
  config: McpConfig,
  query: { code?: string; state?: string; error?: string },
  google?: { exchange: (code: string) => Promise<string>; userinfo: (token: string) => Promise<{ email: string; verified: boolean }> },
): Promise<{ redirect?: string; status?: number; text?: string }> {
  if (!config.oauthSecret) return { status: 503, text: "Google login is not configured on this MCP server" };
  if (query.error || !query.code || !query.state) {
    return { status: 400, text: "login was not completed" };
  }
  const st = verifyJwt(query.state, config.oauthSecret);
  if (!st || st.type !== "oauth_state") return { status: 400, text: "login session expired — start over" };
  const redirectUri = st.redirect_uri as string;
  const clientState = (st.client_state as string | null) ?? null;

  try {
    const deps = googleDeps(config);
    const exchange = google?.exchange ?? ((code: string) => exchangeCode(deps, code));
    const userinfo =
      google?.userinfo ?? ((token: string) => fetchGoogleUser(deps, token));
    const accessToken = await exchange(query.code);
    const user = await userinfo(accessToken);
    if (!user.verified) return oauthError(redirectUri, clientState, "login_requirements_not_met");
    const email = user.email.toLowerCase();
    if (config.allowedEmails && !config.allowedEmails.includes(email)) {
      return oauthError(redirectUri, clientState, "access_denied");
    }
    const code = signJwt(
      {
        type: "authcode",
        client_id: st.client_id,
        redirect_uri: redirectUri,
        challenge: st.code_challenge,
        email,
      },
      config.oauthSecret,
      AUTH_CODE_TTL_SEC,
    );
    const q = new URLSearchParams({ code });
    if (clientState) q.set("state", clientState);
    return { redirect: `${redirectUri}?${q.toString()}` };
  } catch {
    return oauthError(redirectUri, clientState, "server_error");
  }
}

export interface TokenRequest {
  grant_type?: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  code_verifier?: string;
  refresh_token?: string;
}

export function handleToken(
  config: McpConfig,
  body: TokenRequest,
): { status: number; json: unknown } {
  if (!config.oauthSecret) {
    return { status: 503, json: { error: "server_error", error_description: "login not configured" } };
  }
  const fail = (error: string, description: string, status = 400) => ({ status, json: { error, error_description: description } });

  if (body.grant_type === "refresh_token") {
    if (!body.refresh_token) return fail("invalid_request", "refresh_token is required");
    const payload = verifyJwt(body.refresh_token, config.oauthSecret);
    if (!payload || payload.type !== "refresh" || typeof payload.email !== "string") {
      return fail("invalid_grant", "invalid refresh token");
    }
    return {
      status: 200,
      json: {
        access_token: signJwt({ type: "access", email: payload.email }, config.oauthSecret, ACCESS_TOKEN_TTL_SEC),
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SEC,
      },
    };
  }

  if (body.grant_type !== "authorization_code") {
    return fail("unsupported_grant_type", "only authorization_code and refresh_token are supported");
  }
  if (!body.code || !body.redirect_uri || !body.code_verifier) {
    return fail("invalid_request", "code, redirect_uri and code_verifier are required");
  }
  const payload = verifyJwt(body.code, config.oauthSecret);
  if (!payload || payload.type !== "authcode") return fail("invalid_grant", "invalid code");
  if (payload.redirect_uri !== body.redirect_uri) return fail("invalid_grant", "redirect_uri mismatch");
  if (body.client_id && payload.client_id !== body.client_id) {
    return fail("invalid_grant", "client_id mismatch");
  }
  if (pkceChallenge(body.code_verifier) !== payload.challenge) {
    return fail("invalid_grant", "PKCE verification failed");
  }
  const email = payload.email as string;
  return {
    status: 200,
    json: {
      access_token: signJwt({ type: "access", email }, config.oauthSecret, ACCESS_TOKEN_TTL_SEC),
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SEC,
      refresh_token: signJwt({ type: "refresh", email }, config.oauthSecret, REFRESH_TOKEN_TTL_SEC),
    },
  };
}

/** Validate a Bearer access token → caller email, or null. */
export function verifyAccessToken(config: McpConfig, token: string): string | null {
  if (!config.oauthSecret || !token) return null;
  const payload = verifyJwt(token, config.oauthSecret);
  if (!payload || payload.type !== "access" || typeof payload.email !== "string") return null;
  return payload.email;
}
