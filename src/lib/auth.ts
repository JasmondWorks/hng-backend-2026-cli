import crypto from "crypto";
import http from "http";
import { URL } from "url";
import { API_URL, GITHUB_CLIENT_ID, saveCredentials, loadCredentials } from "./config";
import { Credentials } from "../types";

export function buildPkce() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  return { codeVerifier, codeChallenge, state };
}

export function buildGithubAuthUrl(
  redirectUri: string,
  codeChallenge: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

// Starts a temporary local server, waits for GitHub to redirect back,
// then returns the code and state from the callback URL.
export function waitForCallback(port: number): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2>✓ Logged in successfully</h2>
          <p>You can close this tab and return to your terminal.</p>
        </body></html>
      `);

      server.close();

      if (!code || !state) {
        reject(new Error("Missing code or state in callback"));
      } else {
        resolve({ code, state });
      }
    });

    server.listen(port);
    server.on("error", reject);
  });
}

// Exchanges code + code_verifier with the backend and stores the tokens.
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  username: string
): Promise<Credentials> {
  const res = await fetch(`${API_URL}/auth/github/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
  });

  const body = await res.json() as { status: string; data?: { access_token: string; refresh_token: string } };

  if (!res.ok || !body.data) {
    throw new Error("Token exchange failed");
  }

  const creds: Credentials = {
    access_token: body.data.access_token,
    refresh_token: body.data.refresh_token,
    username,
  };

  saveCredentials(creds);
  return creds;
}

// Refreshes the access token using the stored refresh token.
// Returns updated credentials or null if refresh fails.
export async function refreshAccessToken(creds: Credentials): Promise<Credentials | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: creds.refresh_token }),
    });

    const body = await res.json() as { status: string; data?: { access_token: string; refresh_token: string } };

    if (!res.ok || !body.data) return null;

    const updated: Credentials = {
      ...creds,
      access_token: body.data.access_token,
      refresh_token: body.data.refresh_token,
    };

    saveCredentials(updated);
    return updated;
  } catch {
    return null;
  }
}

// Returns valid credentials, auto-refreshing if needed.
// Throws if not logged in or if refresh fails.
export async function requireAuth(): Promise<Credentials> {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error("Not logged in. Run: insighta login");
  }

  // Attempt a refresh to verify the token is still valid.
  // The access token is short-lived (3 min) so we proactively refresh.
  const refreshed = await refreshAccessToken(creds);
  if (!refreshed) {
    throw new Error("Session expired. Run: insighta login");
  }

  return refreshed;
}
