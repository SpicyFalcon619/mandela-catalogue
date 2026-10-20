/**
 * The client address used as a rate-limit key. The left-most X-Forwarded-For entry is whatever the
 * client sent, so a forged value would dodge the login and sign-up limits. Fly.io sets Fly-Client-IP
 * itself; otherwise take the entry the nearest proxy appended (the right-most).
 */
export function clientKey(h: Pick<Headers, "get">): string {
  const fly = h.get("fly-client-ip")?.trim();
  if (fly) return fly;
  const hops = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return hops?.at(-1) || h.get("x-real-ip") || "local";
}
