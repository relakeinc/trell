import { describe, it, expect } from "vitest";
import { mcpConfigFromEnv } from "../src/config";
import {
  beginAuthorize,
  handleCallback,
  handleRegister,
  handleToken,
  isAllowedRedirectUri,
  pkceChallenge,
  signJwt,
  verifyAccessToken,
  verifyJwt,
} from "../src/oauth";

const CONFIG = mcpConfigFromEnv({
  MCP_API_KEY: "k",
  MCP_OAUTH_SECRET: "test-oauth-secret-0123456789abcdef",
  GOOGLE_CLIENT_ID: "gcid",
  GOOGLE_CLIENT_SECRET: "gsec",
  MCP_PUBLIC_URL: "https://mcp.test",
} as NodeJS.ProcessEnv);

// RFC 7636 Appendix B test vector.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("JWT", () => {
  it("round-trips and rejects tampering and expiry", () => {
    const t = signJwt({ type: "access", email: "a@b.c" }, CONFIG.oauthSecret, 60);
    expect(verifyJwt(t, CONFIG.oauthSecret)).toMatchObject({ type: "access", email: "a@b.c" });
    expect(verifyJwt(`${t}x`, CONFIG.oauthSecret)).toBeNull();
    expect(verifyJwt(t, "wrong-secret")).toBeNull();
    const expired = signJwt({ type: "access" }, CONFIG.oauthSecret, -1);
    expect(verifyJwt(expired, CONFIG.oauthSecret)).toBeNull();
  });

  it("implements PKCE S256 per RFC 7636", () => {
    expect(pkceChallenge(VERIFIER)).toBe(CHALLENGE);
  });
});

describe("redirect URIs", () => {
  it("accepts loopback and vscode.dev only", () => {
    expect(isAllowedRedirectUri("http://127.0.0.1:33418/")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:54321/callback")).toBe(true);
    expect(isAllowedRedirectUri("https://vscode.dev/redirect")).toBe(true);
    expect(isAllowedRedirectUri("https://evil.com/")).toBe(false);
    expect(isAllowedRedirectUri("https://mcp.test/")).toBe(false);
    expect(isAllowedRedirectUri("not-a-url")).toBe(false);
  });
});

describe("DCR", () => {
  it("issues a client_id for valid redirects", () => {
    const res = handleRegister({ redirect_uris: ["http://127.0.0.1:33418/"] });
    expect(res.status).toBe(201);
    expect((res.json as { client_id: string }).client_id).toMatch(/^trell_/);
  });

  it("rejects non-loopback redirects", () => {
    expect(handleRegister({ redirect_uris: ["https://evil.com/"] }).status).toBe(400);
    expect(handleRegister({}).status).toBe(400);
  });
});

describe("authorize", () => {
  const params = {
    client_id: "trell_x",
    redirect_uri: "http://127.0.0.1:33418/",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    state: "s1",
    response_type: "code",
  };

  it("bounces to Google with signed state", () => {
    const out = beginAuthorize(CONFIG, params);
    expect(out.redirect).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(out.redirect).toContain("client_id=gcid");
    expect(out.redirect).toContain("redirect_uri=" + encodeURIComponent("https://mcp.test/oauth/callback"));
  });

  it("rejects bad requests", () => {
    expect(beginAuthorize(CONFIG, { ...params, code_challenge_method: "plain" }).status).toBe(400);
    expect(beginAuthorize(CONFIG, { ...params, redirect_uri: "https://evil.com/" }).status).toBe(400);
  });

  it("503s without Google configured", () => {
    const bare = mcpConfigFromEnv({ MCP_API_KEY: "k", MCP_OAUTH_SECRET: "s" } as NodeJS.ProcessEnv);
    expect(beginAuthorize(bare, params).status).toBe(503);
  });
});

describe("callback + token", () => {
  const google = {
    exchange: async () => "goog-access",
    userinfo: async () => ({ email: "User@Example.com", verified: true }),
  };

  async function login(config = CONFIG) {
    const auth = beginAuthorize(config, {
      client_id: "trell_x",
      redirect_uri: "http://127.0.0.1:33418/",
      code_challenge: CHALLENGE,
      code_challenge_method: "S256",
      state: "client-state",
      response_type: "code",
    });
    const state = new URL(auth.redirect!).searchParams.get("state")!;
    return handleCallback(config, { code: "goog-code", state }, google);
  }

  it("completes login and returns an auth code to the client", async () => {
    const out = await login();
    expect(out.redirect).toContain("http://127.0.0.1:33418/?code=");
    expect(out.redirect).toContain("state=client-state");
  });

  it("rejects unverified emails and non-allowlisted emails", async () => {
    const unverified = await login();
    expect(unverified.redirect).toBeDefined();
    const badGoogle = { exchange: async () => "t", userinfo: async () => ({ email: "x@y.z", verified: false }) };
    const auth = beginAuthorize(CONFIG, {
      client_id: "c", redirect_uri: "http://127.0.0.1:1/", code_challenge: CHALLENGE,
      code_challenge_method: "S256", response_type: "code",
    });
    const state = new URL(auth.redirect!).searchParams.get("state")!;
    const out = await handleCallback(CONFIG, { code: "c", state }, badGoogle);
    expect(out.redirect).toContain("error=");

    const locked = mcpConfigFromEnv({
      MCP_API_KEY: "k", MCP_OAUTH_SECRET: CONFIG.oauthSecret, GOOGLE_CLIENT_ID: "g",
      GOOGLE_CLIENT_SECRET: "s", MCP_PUBLIC_URL: "https://mcp.test", MCP_ALLOWED_EMAILS: "other@x.y",
    } as NodeJS.ProcessEnv);
    const auth2 = beginAuthorize(locked, {
      client_id: "c", redirect_uri: "http://127.0.0.1:1/", code_challenge: CHALLENGE,
      code_challenge_method: "S256", response_type: "code",
    });
    const state2 = new URL(auth2.redirect!).searchParams.get("state")!;
    const out2 = await handleCallback(locked, { code: "c", state: state2 }, google);
    expect(out2.redirect).toContain("error=access_denied");
  });

  it("exchanges a code for tokens with valid PKCE", async () => {
    const done = await login();
    const code = new URL(done.redirect!).searchParams.get("code")!;
    const res = handleToken(CONFIG, {
      grant_type: "authorization_code",
      code,
      redirect_uri: "http://127.0.0.1:33418/",
      client_id: "trell_x",
      code_verifier: VERIFIER,
    });
    expect(res.status).toBe(200);
    const json = res.json as { access_token: string; refresh_token: string; token_type: string };
    expect(json.token_type).toBe("Bearer");
    expect(verifyAccessToken(CONFIG, json.access_token)).toBe("user@example.com");
  });

  it("rejects bad verifier, reused audience and expired codes", async () => {
    const done = await login();
    const code = new URL(done.redirect!).searchParams.get("code")!;
    const bad = handleToken(CONFIG, {
      grant_type: "authorization_code", code,
      redirect_uri: "http://127.0.0.1:33418/", code_verifier: "wrong",
    });
    expect(bad.status).toBe(400);

    const expired = signJwt(
      { type: "authcode", client_id: "c", redirect_uri: "http://127.0.0.1:1/", challenge: CHALLENGE, email: "a@b.c" },
      CONFIG.oauthSecret,
      -1,
    );
    const gone = handleToken(CONFIG, {
      grant_type: "authorization_code", code: expired,
      redirect_uri: "http://127.0.0.1:1/", code_verifier: VERIFIER,
    });
    expect(gone.status).toBe(400);
  });

  it("refreshes access tokens", async () => {
    const done = await login();
    const code = new URL(done.redirect!).searchParams.get("code")!;
    const first = handleToken(CONFIG, {
      grant_type: "authorization_code", code,
      redirect_uri: "http://127.0.0.1:33418/", code_verifier: VERIFIER,
    });
    const refresh = (first.json as { refresh_token: string }).refresh_token;
    const second = handleToken(CONFIG, { grant_type: "refresh_token", refresh_token: refresh });
    expect(second.status).toBe(200);
    expect(verifyAccessToken(CONFIG, (second.json as { access_token: string }).access_token)).toBe("user@example.com");

    const bad = handleToken(CONFIG, { grant_type: "refresh_token", refresh_token: "bogus" });
    expect(bad.status).toBe(400);
  });
});
