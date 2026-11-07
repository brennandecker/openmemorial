import { createRemoteJWKSet, jwtVerify } from "jose";

type AuthSettings = Pick<CloudflareEnv, "ACCESS_TEAM_DOMAIN" | "ACCESS_AUD" | "MODERATOR_EMAILS">;
export async function reviewerIdentity(request: Request, env: AuthSettings): Promise<string | null> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || token.length > 16384 || !env.ACCESS_AUD || !env.MODERATOR_EMAILS) return null;
  // This trusted deployment setting, never the incoming Host header, selects the key server.
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN)) return null;
  try {
    const keys = createRemoteJWKSet(new URL(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`), { timeoutDuration: 5000 });
    const { payload } = await jwtVerify(token, keys, { issuer: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD, algorithms: ["RS256"], requiredClaims: ["exp", "iat", "sub", "email"] });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : "";
    const allowed = env.MODERATOR_EMAILS.split(",").map(value => value.toLowerCase().trim()).filter(Boolean);
    return email && allowed.includes(email) ? email : null;
  } catch { return null; }
}
