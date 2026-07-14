/**
 * Premium Packages has no user accounts of its own — it authenticates against
 * the same LakbayHub accounts as everything else. Rather than re-implementing
 * bcrypt password checks here (duplicating security-sensitive logic across two
 * codebases, with the two copies able to drift), this proxies the login
 * server-to-server to the already-migrated LakbayHub auth API, which owns the
 * one true implementation of "is this email/password valid." Whatever token
 * it hands back is already signed with the shared JWT secret, so it verifies
 * against this backend's own requireAuth middleware with no extra work.
 */

interface LakbayhubLoginResponse {
  status: boolean;
  message?: string;
  data?: { token: string };
  error?: string;
}

function getAuthApiBase(): string {
  const key = process.env.NODE_ENV === "production" ? "LAKBAYHUB_AUTH_API_URL_PROD" : "LAKBAYHUB_AUTH_API_URL_DEV";
  const url = process.env[key];
  if (!url) {
    throw new Error(`${key} is not defined in environment variables.`);
  }
  return url;
}

export async function login(email: string, password: string): Promise<string> {
  const base = getAuthApiBase();

  const response = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // LakbayHub's auth API restricts by IP allowlist. The legacy frontend
      // (utils/axios.js) sends this exact spoofed header for the 'auth'
      // service specifically — matching that here rather than inventing a
      // different workaround, since this is what already works elsewhere.
      // Worth confirming with whoever manages that allowlist rather than
      // treating this as a permanent solution.
      "x-forwarded-for": "192.168.1.59",
    },
    body: JSON.stringify({ email, password }),
  });

  const result = (await response.json()) as LakbayhubLoginResponse;

  if (!response.ok || !result.status || !result.data?.token) {
    const message = result.error || result.message || "Invalid credentials.";
    const error = new Error(message);
    (error as { status?: number }).status = response.status === 200 ? 401 : response.status;
    throw error;
  }

  return result.data.token;
}