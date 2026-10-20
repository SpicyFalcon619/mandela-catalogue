import { beforeEach, describe, expect, it } from "vitest";
import { moderateComment } from "@/app/actions/admin";
import { deleteOwnComment, postComment } from "@/app/actions/comments";
import { db } from "@/lib/db";
import { count, form, makeUser, resetRequest, signInAs } from "./helpers";

const setSetting = (key: string, value: string) =>
  db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);

const post = (fields: Record<string, string>) => postComment({}, form({ tape_id: "1", kind: "comment", body: "A perfectly fine post", ...fields }));
const last = () => db().prepare("SELECT * FROM comments ORDER BY id DESC LIMIT 1").get() as { id: number; user_id: number; kind: string; body: string; status: string };

/** The same visibility rule the tape page uses. */
const visibleTo = (userId: number | null) =>
  db()
    .prepare("SELECT id FROM comments WHERE tape_id = 1 AND (status = 'visible' OR (status = 'pending' AND user_id = ?))")
    .all(userId ?? -1)
    .map((r) => (r as { id: number }).id);

beforeEach(() => {
  resetRequest();
  setSetting("comments_enabled", "1");
  setSetting("submissions_enabled", "1");
});

describe("posting", () => {
  it("requires sign-in", async () => {
    const before = count("SELECT COUNT(*) AS n FROM comments");
    expect((await post({})).error).toMatch(/Sign in/);
    expect(count("SELECT COUNT(*) AS n FROM comments")).toBe(before);
  });

  it("shows comments at once but holds theories and corrections for review", async () => {
    const u = makeUser("user");
    await signInAs(u.id);
    await post({ kind: "comment" });
    expect(last().status).toBe("visible");
    for (const kind of ["theory", "correction"]) {
      const res = await post({ kind });
      expect(res.ok).toMatch(/review/);
      expect(last().status).toBe("pending");
    }
  });

  it("lets an admin's own theory go live without review", async () => {
    await signInAs(makeUser("admin").id);
    await post({ kind: "theory" });
    expect(last().status).toBe("visible");
  });

  it("validates kind, length and tape", async () => {
    await signInAs(makeUser("user").id);
    const before = count("SELECT COUNT(*) AS n FROM comments");
    expect((await post({ kind: "announcement" })).error).toBeTruthy();
    expect((await post({ body: "hi" })).error).toBeTruthy();
    expect((await post({ body: "x".repeat(1501) })).error).toBeTruthy();
    expect((await post({ tape_id: "999999" })).error).toMatch(/does not exist/);
    expect((await post({ tape_id: "abc" })).error).toMatch(/does not exist/);
    expect(count("SELECT COUNT(*) AS n FROM comments")).toBe(before);
  });

  it("does not post on an unpublished tape", async () => {
    await signInAs(makeUser("user").id);
    db().prepare("UPDATE tapes SET published = 0 WHERE id = 2").run();
    try {
      expect((await post({ tape_id: "2" })).error).toMatch(/does not exist/);
    } finally {
      db().prepare("UPDATE tapes SET published = 1 WHERE id = 2").run();
    }
  });

  it("respects the admin switches", async () => {
    await signInAs(makeUser("user").id);
    setSetting("comments_enabled", "0");
    expect((await post({ kind: "comment" })).error).toMatch(/off/);
    expect((await post({ kind: "theory" })).ok).toBeTruthy();
    setSetting("comments_enabled", "1");
    setSetting("submissions_enabled", "0");
    expect((await post({ kind: "theory" })).error).toMatch(/off/);
    expect((await post({ kind: "correction" })).error).toMatch(/off/);
    expect((await post({ kind: "comment" })).ok).toBeTruthy();
  });

  it("stores markup as inert text, unchanged", async () => {
    await signInAs(makeUser("user").id);
    const body = `<img src=x onerror=alert(1)> **not bold** [x](https://e.example)`;
    await post({ body });
    expect(last().body).toBe(body);
  });

  it("rate limits a burst from one account", async () => {
    await signInAs(makeUser("user").id);
    const results = [];
    for (let i = 0; i < 7; i++) results.push(await post({ body: `burst post ${i}` }));
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5].error).toMatch(/Slow down/);
  });
});

describe("who can see what", () => {
  it("hides pending posts from everyone except their author", async () => {
    const author = makeUser("user");
    const other = makeUser("user");
    await signInAs(author.id);
    await post({ kind: "theory", body: "a pending theory" });
    const id = last().id;
    expect(visibleTo(author.id)).toContain(id);
    expect(visibleTo(other.id)).not.toContain(id);
    expect(visibleTo(null)).not.toContain(id);
  });

  it("shows a theory to everyone once an admin approves it, and hides it again on hide", async () => {
    const author = makeUser("user");
    await signInAs(author.id);
    await post({ kind: "theory", body: "approve me please" });
    const id = last().id;

    resetRequest();
    await signInAs(makeUser("admin").id);
    await moderateComment(form({ id: String(id), action: "approve", tape_id: "1" }));
    expect(visibleTo(null)).toContain(id);
    await moderateComment(form({ id: String(id), action: "hide", tape_id: "1" }));
    expect(visibleTo(null)).not.toContain(id);
    expect(visibleTo(author.id)).not.toContain(id);
  });
});

describe("deleting", () => {
  it("lets people delete only their own posts", async () => {
    const mine = makeUser("user");
    const theirs = makeUser("user");
    await signInAs(theirs.id);
    await post({ body: "someone else's comment" });
    const theirId = last().id;

    resetRequest();
    await signInAs(mine.id);
    await post({ body: "my own comment" });
    const myId = last().id;

    await deleteOwnComment(theirId, 1);
    expect(db().prepare("SELECT 1 FROM comments WHERE id = ?").get(theirId)).toBeTruthy();
    await deleteOwnComment(myId, 1);
    expect(db().prepare("SELECT 1 FROM comments WHERE id = ?").get(myId)).toBeUndefined();
  });

  it("ignores delete requests from signed-out visitors", async () => {
    const u = makeUser("user");
    await signInAs(u.id);
    await post({ body: "stay put" });
    const id = last().id;
    resetRequest();
    await deleteOwnComment(id, 1);
    expect(db().prepare("SELECT 1 FROM comments WHERE id = ?").get(id)).toBeTruthy();
  });

  it("removes a user's posts when their account is deleted", async () => {
    const u = makeUser("user");
    await signInAs(u.id);
    await post({ body: "going away" });
    db().prepare("DELETE FROM users WHERE id = ?").run(u.id);
    expect(count("SELECT COUNT(*) AS n FROM comments WHERE user_id = ?", u.id)).toBe(0);
  });
});
