import { beforeEach, describe, expect, it } from "vitest";
import { changePasswordAction, loginAction, logoutAction, registerAction } from "@/app/actions/auth";
import { getUser, safeNext } from "@/lib/auth";
import { db } from "@/lib/db";
import { count, form, makeUser, redirectOf, resetRequest, signInAs } from "./helpers";
import { reqHeaders } from "./setup";

let ipCounter = 0;
beforeEach(() => {
  resetRequest();
  // The rate limiter is keyed by IP and lives for the whole process, so each test gets its own address.
  reqHeaders.set("x-forwarded-for", `10.0.0.${++ipCounter}`);
});

const setSetting = (key: string, value: string) =>
  db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);

describe("registration", () => {
  const good = { username: "new_reader", password: "long-enough-pw", confirm: "long-enough-pw" };

  it("creates a plain user, hashes the password and signs them in", async () => {
    expect(await redirectOf(() => registerAction({}, form(good)))).toBe("/");
    const row = db().prepare("SELECT role, banned, password_hash FROM users WHERE username = 'new_reader'").get() as {
      role: string; banned: number; password_hash: string;
    };
    expect(row.role).toBe("user");
    expect(row.banned).toBe(0);
    expect(row.password_hash).not.toContain("long-enough-pw");
    expect((await getUser())?.username).toBe("new_reader");
  });

  it("rejects bad input without creating an account", async () => {
    const bad = [
      { ...good, username: "ab" },
      { ...good, username: "has space" },
      { ...good, username: "<script>" },
      { ...good, password: "short", confirm: "short" },
      { ...good, confirm: "different-pw" },
    ];
    const before = count("SELECT COUNT(*) AS n FROM users");
    for (const b of bad) expect((await registerAction({}, form(b))).error).toBeTruthy();
    expect(count("SELECT COUNT(*) AS n FROM users")).toBe(before);
  });

  it("treats usernames as case-insensitive", async () => {
    const u = makeUser("user");
    const res = await registerAction({}, form({ username: u.username.toUpperCase(), password: "long-enough-pw", confirm: "long-enough-pw" }));
    expect(res.error).toMatch(/taken/);
  });

  it("is closed when the admin turns sign-ups off", async () => {
    setSetting("registration_open", "0");
    try {
      expect((await registerAction({}, form({ ...good, username: "late_comer" }))).error).toMatch(/closed/);
    } finally {
      setSetting("registration_open", "1");
    }
  });

  it("limits sign-ups per connection", async () => {
    let last = "";
    for (let i = 0; i < 6; i++) {
      const r = await registerAction({}, form({ username: `burst_${ipCounter}_${i}`, password: "long-enough-pw", confirm: "long-enough-pw" })).catch(
        () => ({ error: undefined }),
      );
      last = r.error ?? "";
    }
    expect(last).toMatch(/Too many/);
  });
});

describe("login", () => {
  it("signs in with the right password", async () => {
    const u = makeUser("user");
    expect(await redirectOf(() => loginAction({}, form({ username: u.username, password: u.password })))).toBe("/");
    expect((await getUser())?.id).toBe(u.id);
  });

  it("gives the same message for a wrong password and an unknown user", async () => {
    const u = makeUser("user");
    const wrong = await loginAction({}, form({ username: u.username, password: "nope-nope-nope" }));
    const unknown = await loginAction({}, form({ username: "nobody_here", password: "nope-nope-nope" }));
    expect(wrong.error).toBe("Wrong username or password.");
    expect(unknown.error).toBe(wrong.error);
    expect(await getUser()).toBeNull();
  });

  it("refuses a suspended account even with the right password", async () => {
    const u = makeUser("user");
    db().prepare("UPDATE users SET banned = 1 WHERE id = ?").run(u.id);
    expect((await loginAction({}, form({ username: u.username, password: u.password }))).error).toMatch(/suspended/);
    expect(await getUser()).toBeNull();
  });

  it("locks out repeated wrong guesses, even if the next one is correct", async () => {
    const u = makeUser("user");
    for (let i = 0; i < 6; i++) await loginAction({}, form({ username: u.username, password: `guess-${i}-guess` }));
    const res = await loginAction({}, form({ username: u.username, password: u.password }));
    expect(res.error).toMatch(/Too many/);
    expect(await getUser()).toBeNull();
  });

  it("only follows same-site redirect targets", async () => {
    const u = makeUser("user");
    const go = (next: string) => redirectOf(() => loginAction({}, form({ username: u.username, password: u.password, next })));
    expect(await go("/tapes/3")).toBe("/tapes/3");
    reqHeaders.set("x-forwarded-for", "10.9.9.1");
    expect(await go("//evil.example")).toBe("/");
    reqHeaders.set("x-forwarded-for", "10.9.9.2");
    expect(await go("https://evil.example")).toBe("/");
  });
});

describe("sessions", () => {
  it("rejects a tampered or foreign token", async () => {
    const u = makeUser("user");
    await signInAs(u.id);
    const { jar } = await import("./setup");
    const token = jar.get("mc_session")!;
    jar.set("mc_session", token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa"));
    expect(await getUser()).toBeNull();
    jar.set("mc_session", "not.a.jwt");
    expect(await getUser()).toBeNull();
  });

  it("ends on logout and when the account is deleted", async () => {
    const u = makeUser("user");
    await signInAs(u.id);
    expect(await redirectOf(() => logoutAction())).toBe("/");
    expect(await getUser()).toBeNull();

    await signInAs(u.id);
    db().prepare("DELETE FROM users WHERE id = ?").run(u.id);
    expect(await getUser()).toBeNull();
  });
});

describe("change password", () => {
  it("needs the current password", async () => {
    const u = makeUser("user");
    await signInAs(u.id);
    const before = (db().prepare("SELECT password_hash FROM users WHERE id = ?").get(u.id) as { password_hash: string }).password_hash;
    expect((await changePasswordAction({}, form({ current: "wrong-wrong-wrong", next: "brand-new-password" }))).error).toMatch(/wrong/);
    expect((db().prepare("SELECT password_hash FROM users WHERE id = ?").get(u.id) as { password_hash: string }).password_hash).toBe(before);
  });

  it("changes it when the current one matches, and refuses signed-out callers", async () => {
    const u = makeUser("user");
    expect((await changePasswordAction({}, form({ current: u.password, next: "brand-new-password" }))).error).toMatch(/Sign in/);
    await signInAs(u.id);
    expect((await changePasswordAction({}, form({ current: u.password, next: "brand-new-password" }))).ok).toBe("Password changed.");
    reqHeaders.set("x-forwarded-for", "10.9.9.3");
    expect(await redirectOf(() => loginAction({}, form({ username: u.username, password: "brand-new-password" })))).toBe("/");
  });
});

describe("safeNext", () => {
  it.each([
    ["/", "/"],
    ["/admin/users?x=1", "/admin/users?x=1"],
    ["//evil.example", "/"],
    ["https://evil.example", "/"],
    ["/ has space", "/"],
    [undefined, "/"],
    [42, "/"],
  ])("%s -> %s", (input, out) => {
    expect(safeNext(input)).toBe(out);
  });
});
