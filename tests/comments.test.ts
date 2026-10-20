import { beforeEach, describe, expect, it } from "vitest";
import { moderateComment } from "@/app/actions/admin";
import { deleteOwnComment, postComment } from "@/app/actions/comments";
import { sql } from "@/lib/db";
import { count, form, makeUser, resetRequest, signInAs } from "./helpers";

const setSetting = (key: string, value: string) =>
  sql.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);

const post = (fields: Record<string, string>) => postComment({}, form({ tape_id: "1", kind: "comment", body: "A perfectly fine post", ...fields }));
const last = async () => (await sql.get("SELECT * FROM comments ORDER BY id DESC LIMIT 1")) as { id: number; user_id: number; kind: string; body: string; status: string };

/** The same visibility rule the tape page uses. */
const visibleTo = async (userId: number | null) =>
  (await sql.all<{ id: number }>("SELECT id FROM comments WHERE tape_id = 1 AND (status = 'visible' OR (status = 'pending' AND user_id = ?))", userId ?? -1)).map((r) => r.id);

beforeEach(async () => {
  resetRequest();
  await setSetting("comments_enabled", "1");
  await setSetting("submissions_enabled", "1");
});

describe("posting", () => {
  it("requires sign-in", async () => {
    const before = await count("SELECT COUNT(*) AS n FROM comments");
    expect((await post({})).error).toMatch(/Sign in/);
    expect(await count("SELECT COUNT(*) AS n FROM comments")).toBe(before);
  });

  it("shows comments at once but holds theories and corrections for review", async () => {
    const u = await makeUser("user");
    await signInAs(u.id);
    await post({ kind: "comment" });
    expect((await last()).status).toBe("visible");
    for (const kind of ["theory", "correction"]) {
      const res = await post({ kind });
      expect(res.ok).toMatch(/review/);
      expect((await last()).status).toBe("pending");
    }
  });

  it("lets an admin's own theory go live without review", async () => {
    await signInAs((await makeUser("admin")).id);
    await post({ kind: "theory" });
    expect((await last()).status).toBe("visible");
  });

  it("validates kind, length and tape", async () => {
    await signInAs((await makeUser("user")).id);
    const before = await count("SELECT COUNT(*) AS n FROM comments");
    expect((await post({ kind: "announcement" })).error).toBeTruthy();
    expect((await post({ body: "hi" })).error).toBeTruthy();
    expect((await post({ body: "x".repeat(1501) })).error).toBeTruthy();
    expect((await post({ tape_id: "999999" })).error).toMatch(/does not exist/);
    expect((await post({ tape_id: "abc" })).error).toMatch(/does not exist/);
    expect(await count("SELECT COUNT(*) AS n FROM comments")).toBe(before);
  });

  it("does not post on an unpublished tape", async () => {
    await signInAs((await makeUser("user")).id);
    await sql.run("UPDATE tapes SET published = 0 WHERE id = 2");
    try {
      expect((await post({ tape_id: "2" })).error).toMatch(/does not exist/);
    } finally {
      await sql.run("UPDATE tapes SET published = 1 WHERE id = 2");
    }
  });

  it("respects the admin switches", async () => {
    await signInAs((await makeUser("user")).id);
    await setSetting("comments_enabled", "0");
    expect((await post({ kind: "comment" })).error).toMatch(/off/);
    expect((await post({ kind: "theory" })).ok).toBeTruthy();
    await setSetting("comments_enabled", "1");
    await setSetting("submissions_enabled", "0");
    expect((await post({ kind: "theory" })).error).toMatch(/off/);
    expect((await post({ kind: "correction" })).error).toMatch(/off/);
    expect((await post({ kind: "comment" })).ok).toBeTruthy();
  });

  it("stores markup as inert text, unchanged", async () => {
    await signInAs((await makeUser("user")).id);
    const body = `<img src=x onerror=alert(1)> **not bold** [x](https://e.example)`;
    await post({ body });
    expect((await last()).body).toBe(body);
  });

  it("rate limits a burst from one account", async () => {
    await signInAs((await makeUser("user")).id);
    const results = [];
    for (let i = 0; i < 7; i++) results.push(await post({ body: `burst post ${i}` }));
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5].error).toMatch(/Slow down/);
  });
});

describe("who can see what", () => {
  it("hides pending posts from everyone except their author", async () => {
    const author = await makeUser("user");
    const other = await makeUser("user");
    await signInAs(author.id);
    await post({ kind: "theory", body: "a pending theory" });
    const id = (await last()).id;
    expect(await visibleTo(author.id)).toContain(id);
    expect(await visibleTo(other.id)).not.toContain(id);
    expect(await visibleTo(null)).not.toContain(id);
  });

  it("shows a theory to everyone once an admin approves it, and hides it again on hide", async () => {
    const author = await makeUser("user");
    await signInAs(author.id);
    await post({ kind: "theory", body: "approve me please" });
    const id = (await last()).id;

    resetRequest();
    await signInAs((await makeUser("admin")).id);
    await moderateComment(form({ id: String(id), action: "approve", tape_id: "1" }));
    expect(await visibleTo(null)).toContain(id);
    await moderateComment(form({ id: String(id), action: "hide", tape_id: "1" }));
    expect(await visibleTo(null)).not.toContain(id);
    expect(await visibleTo(author.id)).not.toContain(id);
  });
});

describe("deleting", () => {
  it("lets people delete only their own posts", async () => {
    const mine = await makeUser("user");
    const theirs = await makeUser("user");
    await signInAs(theirs.id);
    await post({ body: "someone else's comment" });
    const theirId = (await last()).id;

    resetRequest();
    await signInAs(mine.id);
    await post({ body: "my own comment" });
    const myId = (await last()).id;

    await deleteOwnComment(theirId, 1);
    expect(await sql.get("SELECT 1 FROM comments WHERE id = ?", theirId)).toBeTruthy();
    await deleteOwnComment(myId, 1);
    expect(await sql.get("SELECT 1 FROM comments WHERE id = ?", myId)).toBeUndefined();
  });

  it("ignores delete requests from signed-out visitors", async () => {
    const u = await makeUser("user");
    await signInAs(u.id);
    await post({ body: "stay put" });
    const id = (await last()).id;
    resetRequest();
    await deleteOwnComment(id, 1);
    expect(await sql.get("SELECT 1 FROM comments WHERE id = ?", id)).toBeTruthy();
  });

  it("removes a user's posts when their account is deleted", async () => {
    const u = await makeUser("user");
    await signInAs(u.id);
    await post({ body: "going away" });
    await sql.run("DELETE FROM users WHERE id = ?", u.id);
    expect(await count("SELECT COUNT(*) AS n FROM comments WHERE user_id = ?", u.id)).toBe(0);
  });
});
