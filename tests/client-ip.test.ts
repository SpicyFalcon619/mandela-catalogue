import { beforeEach, describe, expect, it } from "vitest";
import { loginAction } from "@/app/actions/auth";
import { clientKey } from "@/lib/client-ip";
import { form, makeUser, resetRequest } from "./helpers";
import { reqHeaders } from "./setup";

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe("clientKey", () => {
  it("prefers Fly-Client-IP, which the platform sets itself", () => {
    expect(clientKey(h({ "fly-client-ip": "203.0.113.9", "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("203.0.113.9");
  });

  it("ignores client-supplied left-most X-Forwarded-For entries", () => {
    expect(clientKey(h({ "x-forwarded-for": "6.6.6.6, 66.66.66.66, 198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientKey(h({ "x-forwarded-for": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("falls back to X-Real-IP and then a fixed key", () => {
    expect(clientKey(h({ "x-real-ip": "192.0.2.1" }))).toBe("192.0.2.1");
    expect(clientKey(h({}))).toBe("local");
  });
});

describe("login lockout cannot be dodged by forging headers", () => {
  beforeEach(resetRequest);

  it("keeps counting when the attacker rotates a fake left-most X-Forwarded-For", async () => {
    const u = makeUser("user");
    for (let i = 0; i < 6; i++) {
      reqHeaders.set("x-forwarded-for", `9.9.9.${i}, 198.51.100.50`);
      await loginAction({}, form({ username: u.username, password: `wrong-guess-${i}` }));
    }
    reqHeaders.set("x-forwarded-for", "9.9.9.200, 198.51.100.50");
    const res = await loginAction({}, form({ username: u.username, password: u.password }));
    expect(res.error).toMatch(/Too many/);
  });

  it("does the same with Fly-Client-IP, even if X-Forwarded-For changes", async () => {
    const u = makeUser("user");
    for (let i = 0; i < 6; i++) {
      reqHeaders.set("fly-client-ip", "203.0.113.77");
      reqHeaders.set("x-forwarded-for", `7.7.7.${i}`);
      await loginAction({}, form({ username: u.username, password: `wrong-guess-${i}` }));
    }
    reqHeaders.set("x-forwarded-for", "7.7.7.250");
    expect((await loginAction({}, form({ username: u.username, password: u.password }))).error).toMatch(/Too many/);
  });

  it("still lets a different real client in", async () => {
    const u = makeUser("user");
    reqHeaders.set("fly-client-ip", "203.0.113.200");
    await expect(loginAction({}, form({ username: u.username, password: u.password }))).rejects.toThrow(/NEXT_REDIRECT/);
  });
});
