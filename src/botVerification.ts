type BotSettings = Pick<CloudflareEnv, "TURNSTILE_SECRET" | "TURNSTILE_HOSTNAMES">;
export async function verifySubmission(token: unknown, request: Request, env: BotSettings): Promise<boolean> {
  if (typeof token !== "string" || !token || token.length > 2048 || !env.TURNSTILE_SECRET) return false;
  const allowed = env.TURNSTILE_HOSTNAMES.split(",").map(value => value.trim()).filter(Boolean);
  const hostname = new URL(request.url).hostname;
  if (!allowed.includes(hostname)) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(10000), body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }) });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
    return result.success === true && result.action === "share_memory" && result.hostname === hostname;
  } catch { return false; }
}
