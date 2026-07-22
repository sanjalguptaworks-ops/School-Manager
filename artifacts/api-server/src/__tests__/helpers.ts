import type { Express } from "express";

/**
 * Starts the real Express app (see src/app.ts) on an ephemeral port for the
 * duration of a test file, against whatever DATABASE_URL is set in the
 * environment -- point this at a disposable Neon branch, never production.
 */
export async function startTestServer(app: Express) {
  const server = await new Promise<import("http").Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to bind test server");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * Logs in as a seeded account (see api-server/src/seed.ts -- all seeded
 * accounts share SEED_PASSWORD) and returns the session cookie header to
 * pass on subsequent requests. There's no cookie jar here since these are
 * plain fetch calls, not a browser -- callers just forward the returned
 * cookie string manually.
 */
export async function loginAs(baseUrl: string, email: string, password = "Password123!"): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error(`Login for ${email} didn't set a cookie`);
  // Only the name=value pair is needed on the request Cookie header, not the
  // attributes (Path, HttpOnly, etc.) that come after the first semicolon.
  return setCookie.split(";")[0]!;
}
