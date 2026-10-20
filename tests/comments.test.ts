import { beforeEach, describe, expect, it } from "vitest";
import { deleteComment, editComment, postComment } from "@/app/actions/comments";
import { getComment, getCommentCounts, getThread } from "@/lib/comments";
import { sql } from "@/lib/db";
import { count, makeUser, resetRequest, signInAs } from "./helpers";

const setSetting = (key: string, value: string) =>
  sql.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);

let n = 0;
type Input = Parameters<typeof postComment>[0];
/** Every call gets its own text, so the duplicate check never trips by accident. */
const post = (o: Partial<Input> = {}) => postComment({ tapeId: 1, kind: "comment", body: `A perfectly fine post number ${++n}`, ...o });
async function ok(o: Partial<Input> = {}) {
  const r = await post(o);
  if (!r.ok) throw new Error(`post failed: ${r.error}`);
  return r.comment;
}
const row = (id: number) =>
  sql.get<{ status: string; depth: number; parent_id: number | null; deleted: number; body: string; spoiler: number; edited_at: string | null }>(
    "SELECT status, depth, parent_id, deleted, body, spoiler, edited_at FROM comments WHERE id = ?",
    id,
  );

beforeEach(async () => {
  resetRequest();
  await setSetting("comments_enabled", "1");
  await setSetting("submissions_enabled", "1");
});

describe("posting", () => {
  it("requires sign-in", async () => {
    const before = await count("SELECT COUNT(*) AS n FROM comments");
    const r = await post();
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/Sign in/);
    expect(await count("SELECT COUNT(*) AS n FROM comments")).toBe(before);
  });

  it("shows comments at once but holds theories and corrections for review", async () => {
    await signInAs((await makeUser("user")).id);
    const c = await post({ kind: "comment" });
    expect(c.ok && c.comment.status).toBe("visible");
    for (const kind of ["theory", "correction"] as const) {
      const r = await post({ kind });
      expect(r.ok && r.message).toMatch(/review/);
      expect(r.ok && r.comment.status).toBe("pending");
    }
  });

  it("lets an admin's own theory go live without review", async () => {
    await signInAs((await makeUser("admin")).id);
    expect((await ok({ kind: "theory" })).status).toBe("visible");
  });

  it("validates kind, length and tape, and hands the draft back on error", async () => {
    await signInAs((await makeUser("user")).id);
    const before = await count("SELECT COUNT(*) AS n FROM comments");
    const bad = [
      await post({ kind: "announcement" as never }),
      await post({ body: "hi" }),
      await post({ body: "x".repeat(1501) }),
      await post({ tapeId: 999999 }),
      await post({ tapeId: Number("abc") }),
    ];
    for (const r of bad) expect(r.ok).toBe(false);
    const short = bad[1];
    expect(!short.ok && short.body).toBe("hi");
    expect(await count("SELECT COUNT(*) AS n FROM comments")).toBe(before);
  });

  it("does not post on an unpublished tape", async () => {
    await signInAs((await makeUser("user")).id);
    await sql.run("UPDATE tapes SET published = 0 WHERE id = 2");
    try {
      const r = await post({ tapeId: 2 });
      expect(!r.ok && r.error).toMatch(/does not exist/);
    } finally {
      await sql.run("UPDATE tapes SET published = 1 WHERE id = 2");
    }
  });

  it("respects the admin switches", async () => {
    await signInAs((await makeUser("user")).id);
    await setSetting("comments_enabled", "0");
    expect((await post({ kind: "comment" })).ok).toBe(false);
    expect((await post({ kind: "theory" })).ok).toBe(true);
    await setSetting("comments_enabled", "1");
    await setSetting("submissions_enabled", "0");
    expect((await post({ kind: "theory" })).ok).toBe(false);
    expect((await post({ kind: "correction" })).ok).toBe(false);
    expect((await post({ kind: "comment" })).ok).toBe(true);
  });

  it("stores markup as inert text, unchanged", async () => {
    await signInAs((await makeUser("user")).id);
    const body = `<img src=x onerror=alert(1)> **not bold** [x](https://e.example)`;
    expect((await ok({ body })).body).toBe(body);
  });

  it("limits a burst from one account", async () => {
    await signInAs((await makeUser("user")).id);
    const results = [];
    for (let i = 0; i < 7; i++) results.push(await post());
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    const sixth = results[5];
    expect(!sixth.ok && sixth.error).toMatch(/Slow down/);
  });

  it("refuses the same text twice in a row", async () => {
    await signInAs((await makeUser("user")).id);
    await ok({ body: "Exactly the same words" });
    const again = await post({ body: "Exactly the same words" });
    expect(!again.ok && again.error).toMatch(/already posted/);
  });

  it("can be flagged as containing spoilers", async () => {
    await signInAs((await makeUser("user")).id);
    const c = await ok({ spoiler: true });
    expect(c.spoiler).toBe(true);
    expect((await row(c.id))!.spoiler).toBe(1);
  });
});

describe("replies", () => {
  it("attach to their parent one level down, and are always plain comments", async () => {
    await signInAs((await makeUser("user")).id);
    const top = await ok();
    const reply = await ok({ parentId: top.id, kind: "theory" });
    expect(reply.parentId).toBe(top.id);
    expect(reply.depth).toBe(1);
    expect(reply.kind).toBe("comment");
    expect(reply.status).toBe("visible");
  });

  it("stop nesting at the maximum depth and attach to the level above", async () => {
    await signInAs((await makeUser("user")).id);
    const chain = [await ok()];
    for (let i = 0; i < 3; i++) {
      resetRequest();
      await signInAs((await makeUser("user")).id); // a new author each time keeps clear of the per-minute limit
      chain.push(await ok({ parentId: chain[i].id }));
    }
    expect(chain.map((x) => x.depth)).toEqual([0, 1, 2, 3]);
    resetRequest();
    await signInAs((await makeUser("user")).id);
    const tooDeep = await ok({ parentId: chain[3].id });
    expect(tooDeep.depth).toBe(3);
    expect(tooDeep.parentId).toBe(chain[2].id);
  });

  it("cannot go under a comment that is pending, hidden, removed, missing or on another tape", async () => {
    const me = await makeUser("user");
    await signInAs(me.id);
    const pending = await ok({ kind: "theory" });
    const hidden = await ok();
    await sql.run("UPDATE comments SET status = 'hidden' WHERE id = ?", hidden.id);
    const gone = await ok();
    await sql.run("UPDATE comments SET deleted = 1 WHERE id = ?", gone.id);
    resetRequest();
    await signInAs((await makeUser("user")).id);
    const elsewhere = await ok({ tapeId: 3 });
    for (const parentId of [pending.id, hidden.id, gone.id, elsewhere.id, 987654]) {
      const r = await post({ parentId });
      expect(r.ok, `parent ${parentId}`).toBe(false);
      expect(!r.ok && r.error).toMatch(/no longer there/);
    }
  });

  it("need comments to be switched on", async () => {
    await signInAs((await makeUser("user")).id);
    const top = await ok();
    await setSetting("comments_enabled", "0");
    expect((await post({ parentId: top.id })).ok).toBe(false);
  });
});

describe("editing", () => {
  it("lets only the author change their text, and marks it edited", async () => {
    const author = await makeUser("user");
    await signInAs(author.id);
    const c = await ok({ body: "First version of this" });
    const saved = await editComment({ id: c.id, body: "Second version of this" });
    expect(saved.ok && saved.comment.body).toBe("Second version of this");
    expect(saved.ok && saved.comment.editedAt).toBeTruthy();
    expect(saved.ok && saved.comment.status).toBe("visible");

    resetRequest();
    await signInAs((await makeUser("user")).id);
    const stranger = await editComment({ id: c.id, body: "Hijacked text here" });
    expect(stranger.ok).toBe(false);
    expect((await row(c.id))!.body).toBe("Second version of this");
  });

  it("applies the same length rules as posting", async () => {
    await signInAs((await makeUser("user")).id);
    const c = await ok();
    expect((await editComment({ id: c.id, body: "no" })).ok).toBe(false);
    expect((await editComment({ id: c.id, body: "x".repeat(1501) })).ok).toBe(false);
  });

  it("does nothing when nothing changed", async () => {
    await signInAs((await makeUser("user")).id);
    const c = await ok({ body: "Leave me alone" });
    const r = await editComment({ id: c.id, body: "Leave me alone" });
    expect(r.ok && r.message).toMatch(/No changes/);
    expect((await row(c.id))!.edited_at).toBeNull();
  });

  it("sends an approved theory back to review, but not an admin's, and not a plain comment", async () => {
    const me = await makeUser("user");
    await signInAs(me.id);
    const theory = await ok({ kind: "theory" });
    await sql.run("UPDATE comments SET status = 'visible' WHERE id = ?", theory.id); // approved by an admin
    const r = await editComment({ id: theory.id, body: "A completely different theory now" });
    expect(r.ok && r.comment.status).toBe("pending");
    expect(r.ok && r.message).toMatch(/review/);

    const plain = await ok();
    const e = await editComment({ id: plain.id, body: "Plain comment, edited text" });
    expect(e.ok && e.comment.status).toBe("visible");

    resetRequest();
    await signInAs((await makeUser("admin")).id);
    const mine = await ok({ kind: "theory" });
    const a = await editComment({ id: mine.id, body: "Admin theory, edited text" });
    expect(a.ok && a.comment.status).toBe("visible");
  });

  it("refuses removed and moderator-hidden comments, and signed-out callers", async () => {
    await signInAs((await makeUser("user")).id);
    const hidden = await ok();
    await sql.run("UPDATE comments SET status = 'hidden' WHERE id = ?", hidden.id);
    expect((await editComment({ id: hidden.id, body: "Trying to sneak a change" })).ok).toBe(false);
    const gone = await ok();
    await sql.run("UPDATE comments SET deleted = 1 WHERE id = ?", gone.id);
    expect((await editComment({ id: gone.id, body: "Editing a removed one" })).ok).toBe(false);
    resetRequest();
    expect((await editComment({ id: hidden.id, body: "Not even signed in" })).ok).toBe(false);
  });
});

describe("deleting", () => {
  it("removes a comment without replies completely", async () => {
    await signInAs((await makeUser("user")).id);
    const c = await ok();
    const r = await deleteComment(c.id);
    expect(r).toEqual({ ok: true, removed: "deleted" });
    expect(await row(c.id)).toBeUndefined();
  });

  it("keeps a placeholder when there are replies, and drops it once the last reply goes", async () => {
    const a = await makeUser("user");
    const b = await makeUser("user");
    await signInAs(a.id);
    const top = await ok({ body: "Top comment with replies" });
    resetRequest();
    await signInAs(b.id);
    const reply = await ok({ parentId: top.id, body: "A reply under it" });

    resetRequest();
    await signInAs(a.id);
    expect(await deleteComment(top.id)).toEqual({ ok: true, removed: "soft" });
    const placeholder = (await getComment(top.id, null))!;
    expect(placeholder).toMatchObject({ deleted: true, body: "", username: "[deleted]", userId: 0, ups: 0 });
    expect((await row(reply.id))!.parent_id).toBe(top.id); // the reply is still there

    resetRequest();
    await signInAs(b.id);
    expect(await deleteComment(reply.id)).toEqual({ ok: true, removed: "deleted" });
    expect(await row(top.id)).toBeUndefined(); // nothing left to hold the placeholder up
  });

  it("lets an admin remove anyone's comment but nobody else's", async () => {
    const author = await makeUser("user");
    await signInAs(author.id);
    const c = await ok();
    const d = await ok();
    resetRequest();
    await signInAs((await makeUser("user")).id);
    expect((await deleteComment(c.id)).ok).toBe(false);
    resetRequest();
    expect((await deleteComment(c.id)).ok).toBe(false); // signed out
    resetRequest();
    await signInAs((await makeUser("admin")).id);
    expect((await deleteComment(c.id)).ok).toBe(true);
    expect(await row(c.id)).toBeUndefined();
    expect(await row(d.id)).toBeTruthy();
  });

  it("takes the votes and reports with it", async () => {
    const author = await makeUser("user");
    await signInAs(author.id);
    const c = await ok();
    await sql.run("INSERT INTO comment_votes (comment_id, user_id, value) VALUES (?, 999, 1)", c.id);
    await sql.run("INSERT INTO comment_reports (comment_id, user_id, reason) VALUES (?, 998, 'spam')", c.id);
    await deleteComment(c.id);
    expect(await count("SELECT COUNT(*) AS n FROM comment_votes WHERE comment_id = ?", c.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ?", c.id)).toBe(0);
  });

  it("reports a missing comment as an error", async () => {
    await signInAs((await makeUser("user")).id);
    expect((await deleteComment(987654)).ok).toBe(false);
  });
});

describe("what each viewer can see", () => {
  it("shows pending posts only to their author, never hidden ones", async () => {
    const author = await makeUser("user");
    const other = await makeUser("user");
    await signInAs(author.id);
    const visible = await ok();
    const pending = await ok({ kind: "theory" });
    const hidden = await ok();
    await sql.run("UPDATE comments SET status = 'hidden' WHERE id = ?", hidden.id);
    const ids = async (v: { id: number; role: "user" | "admin" } | null) => (await getThread(1, v)).map((c) => c.id);
    expect(await ids({ id: author.id, role: "user" })).toEqual(expect.arrayContaining([visible.id, pending.id]));
    expect(await ids({ id: author.id, role: "user" })).not.toContain(hidden.id);
    expect(await ids({ id: other.id, role: "user" })).toContain(visible.id);
    expect(await ids({ id: other.id, role: "user" })).not.toContain(pending.id);
    expect(await ids(null)).not.toContain(pending.id);
  });

  it("counts only visible, non-removed comments per tape", async () => {
    await signInAs((await makeUser("user")).id);
    const before = (await getCommentCounts())[4] ?? 0;
    const a = await ok({ tapeId: 4 });
    await ok({ tapeId: 4 });
    await ok({ tapeId: 4, kind: "theory" }); // pending: not counted
    expect((await getCommentCounts())[4]).toBe(before + 2);
    await sql.run("UPDATE comments SET deleted = 1 WHERE id = ?", a.id);
    expect((await getCommentCounts())[4]).toBe(before + 1);
  });
});
