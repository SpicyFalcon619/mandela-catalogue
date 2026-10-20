import { beforeEach, describe, expect, it } from "vitest";
import { loginAction, registerAction } from "@/app/actions/auth";
import { postComment } from "@/app/actions/comments";
import { form, makeUser, resetRequest, signInAs } from "./helpers";
import { reqHeaders } from "./setup";

// React 19 clears a form after every server action. Failed submits must hand back what the visitor typed
// (never passwords) so the form can show it again.
let n = 0;
beforeEach(() => {
  resetRequest();
  reqHeaders.set("x-forwarded-for", `10.20.0.${++n}`);
});

describe("failed submits echo non-secret input", () => {
  it("login keeps the username, whatever the error", async () => {
    const u = await makeUser("user");
    const wrong = await loginAction({}, form({ username: ` ${u.username} `, password: "nope-nope-nope" }));
    expect(wrong).toEqual({ error: "Wrong username or password.", username: u.username });
    const unknown = await loginAction({}, form({ username: "nobody_here", password: "x" }));
    expect(unknown.username).toBe("nobody_here");
  });

  it("sign-up keeps the username on every validation error, and never returns a password", async () => {
    const cases: Record<string, string>[] = [
      { username: "ab", password: "long-enough-pw", confirm: "long-enough-pw" },
      { username: "fine_name", password: "short", confirm: "short" },
      { username: "fine_name", password: "long-enough-pw", confirm: "different-pw" },
    ];
    for (const c of cases) {
      const res = await registerAction({}, form(c));
      expect(res.error).toBeTruthy();
      expect(res.username).toBe(c.username);
      expect(JSON.stringify(res)).not.toContain(c.password);
    }
    const taken = await makeUser("user");
    const res = await registerAction({}, form({ username: taken.username, password: "long-enough-pw", confirm: "long-enough-pw" }));
    expect(res).toEqual({ error: "That username is taken.", username: taken.username });
  });

  it("a rejected comment gives the draft and its type back", async () => {
    await signInAs((await makeUser("user")).id);
    const res = await postComment({}, form({ tape_id: "999999", kind: "theory", body: "My long, carefully written theory" }));
    expect(res.error).toMatch(/does not exist/);
    expect(res.body).toBe("My long, carefully written theory");
    expect(res.kind).toBe("theory");
  });

  it("a rate-limited comment keeps the draft too", async () => {
    await signInAs((await makeUser("user")).id);
    let last = {} as Awaited<ReturnType<typeof postComment>>;
    for (let i = 0; i < 6; i++) last = await postComment({}, form({ tape_id: "1", kind: "comment", body: `draft number ${i}` }));
    expect(last.error).toMatch(/Slow down/);
    expect(last.body).toBe("draft number 5");
  });

  it("a successful post returns no draft, so the form clears", async () => {
    await signInAs((await makeUser("user")).id);
    const res = await postComment({}, form({ tape_id: "1", kind: "comment", body: "posted fine" }));
    expect(res.ok).toBeTruthy();
    expect(res.body).toBeUndefined();
  });
});
