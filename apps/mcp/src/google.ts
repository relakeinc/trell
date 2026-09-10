export interface GoogleOAuthDeps {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchFn?: typeof fetch;
}

export interface GoogleUser {
  email: string;
  verified: boolean;
}

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

/** Login URL (same Google client as the Trell dashboard → consent usually pre-granted). */
export function googleAuthUrl(deps: GoogleOAuthDeps, state: string): string {
  const q = new URLSearchParams({
    client_id: deps.clientId,
    redirect_uri: deps.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  return `${AUTH_URL}?${q.toString()}`;
}

export async function exchangeCode(deps: GoogleOAuthDeps, code: string): Promise<string> {
  const fetchFn = deps.fetchFn ?? fetch;
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: deps.clientId,
      client_secret: deps.clientSecret,
      redirect_uri: deps.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`);
  const body = (await res.json()) as { access_token?: string; error?: string };
  if (!body.access_token) throw new Error(`google token exchange failed: ${body.error ?? "no token"}`);
  return body.access_token;
}

export async function fetchGoogleUser(deps: GoogleOAuthDeps, accessToken: string): Promise<GoogleUser> {
  const fetchFn = deps.fetchFn ?? fetch;
  const res = await fetchFn(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`google userinfo failed: ${res.status}`);
  const body = (await res.json()) as { email?: string; email_verified?: boolean };
  if (!body.email) throw new Error("google userinfo has no email");
  return { email: body.email, verified: body.email_verified ?? false };
}
