import { beforeEach, describe, expect, it } from "vitest";
import { moderateComment, pinComment, resolveReports, saveEntity, deleteEntity, updateUser } from "@/app/actions/admin";
import { markRepliesRead, postComment, reportComment, voteComment } from "@/app/actions/comments";
import { countUnreadReplies, getComment, getRepliesTo, getThread } from "@/lib/comments";
import { sql } from "@/lib/db";
import { count, form, makeUser, redirectOf, resetRequest, signInAs } from "./helpers";

let n = 0;
async function postAs(user: { id: number }, o: Partial<Parameters<typeof postComment>[0]> = {}) {
  resetRequest();
  await signInAs(user.id);
  const r = await postComment({ tapeId: 1, kind: "comment", body: `Discussion test post number ${++n}`, ...o });
  if (!r.ok) throw new Error(r.error);
  return r.comment;
}
const act = async <T>(user: { id: number } | null, fn: () => Promise<T>) => {
  resetRequest();
  if (user) await signInAs(user.id);
  return fn();
};
const status = async (id: number) => (await sql.get<{ status: string }>("SELECT status FROM comments WHERE id = ?", id))?.status;

beforeEach(resetRequest);

describe("voting", () => {
  it("counts one vote per person, lets them switch, and lets them take it back", async () => {
    const author = await makeUser("user");
    const a = await makeUser("user");
    const b = await makeUser("user");
    const c = await postAs(author);
    expect(await act(a, () => voteComment(c.id, 1))).toEqual({ ok: true, ups: 1, downs: 0, myVote: 1 });
    expect(await act(b, () => voteComment(c.id, 1))).toEqual({ ok: true, ups: 2, downs: 0, myVote: 1 });
    expect(await act(a, () => voteComment(c.id, 1))).toEqual({ ok: true, ups: 2, downs: 0, myVote: 1 }); // same vote again: still one
    expect(await act(a, () => voteComment(c.id, -1))).toEqual({ ok: true, ups: 1, downs: 1, myVote: -1 }); // switched
    expect(await act(a, () => voteComment(c.id, 0))).toEqual({ ok: true, ups: 1, downs: 0, myVote: 0 }); // taken back
    expect(await count("SELECT COUNT(*) AS n FROM comment_votes WHERE comment_id = ?", c.id)).toBe(1);
  });

  it("shows each viewer their own vote and everyone the totals", async () => {
    const author = await makeUser("user");
    const a = await makeUser("user");
    const c = await postAs(author);
    await act(a, () => voteComment(c.id, -1));
    expect((await getComment(c.id, { id: a.id, role: "user" }))!).toMatchObject({ ups: 0, downs: 1, myVote: -1 });
    expect((await getComment(c.id, null))!).toMatchObject({ ups: 0, downs: 1, myVote: 0 });
    const thread = await getThread(1, { id: a.id, role: "user" });
    expect(thread.find((x) => x.id === c.id)!.myVote).toBe(-1);
  });

  it("refuses guests, your own comment, bad values, and comments that are not visible", async () => {
    const author = await makeUser("user");
    const voter = await makeUser("user");
    const c = await postAs(author);
    expect((await act(null, () => voteComment(c.id, 1))).ok).toBe(false);
    expect((await act(author, () => voteComment(c.id, 1))).ok).toBe(false);
    for (const bad of [2, -2, 0.5, Number.NaN]) expect((await act(voter, () => voteComment(c.id, bad))).ok, String(bad)).toBe(false);
    expect((await act(voter, () => voteComment(987654, 1))).ok).toBe(false);
    const pending = await postAs(author, { kind: "theory" });
    expect((await act(voter, () => voteComment(pending.id, 1))).ok).toBe(false);
    await sql.run("UPDATE comments SET status = 'hidden' WHERE id = ?", c.id);
    expect((await act(voter, () => voteComment(c.id, 1))).ok).toBe(false);
  });

  it("limits how fast one person can vote", async () => {
    const author = await makeUser("user");
    const voter = await makeUser("user");
    const c = await postAs(author);
    resetRequest();
    await signInAs(voter.id);
    let blocked = 0;
    for (let i = 0; i < 65; i++) if (!(await voteComment(c.id, i % 2 === 0 ? 1 : -1)).ok) blocked += 1;
    expect(blocked).toBeGreaterThanOrEqual(4);
  });
});

describe("reporting", () => {
  it("needs a known reason, a signed-in user, and someone else's visible comment", async () => {
    const author = await makeUser("user");
    const other = await makeUser("user");
    const c = await postAs(author);
    expect((await act(null, () => reportComment(c.id, "spam"))).ok).toBe(false);
    expect((await act(other, () => reportComment(c.id, "because"))).ok).toBe(false);
    expect((await act(author, () => reportComment(c.id, "spam"))).ok).toBe(false); // your own
    expect((await act(other, () => reportComment(987654, "spam"))).ok).toBe(false);
    expect((await act(other, () => reportComment(c.id, "spam"))).ok).toBe(true);
    expect(await count("SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ?", c.id)).toBe(1);
  });

  it("counts each reporter once, however often they report", async () => {
    const author = await makeUser("user");
    const other = await makeUser("user");
    const c = await postAs(author);
    for (let i = 0; i < 3; i++) await act(other, () => reportComment(c.id, "spam"));
    expect(await count("SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ?", c.id)).toBe(1);
    expect(await status(c.id)).toBe("visible");
  });

  it("hides a comment once three different people report it", async () => {
    const author = await makeUser("user");
    const c = await postAs(author);
    for (let i = 0; i < 2; i++) {
      const r = await makeUser("user");
      expect(await act(r, () => reportComment(c.id, "abuse"))).toMatchObject({ ok: true, hidden: false });
    }
    expect(await status(c.id)).toBe("visible");
    const third = await makeUser("user");
    expect(await act(third, () => reportComment(c.id, "abuse"))).toMatchObject({ ok: true, hidden: true });
    expect(await status(c.id)).toBe("hidden");
    expect((await getThread(1, null)).some((x) => x.id === c.id)).toBe(false);
  });

  it("never auto-hides an admin's comment", async () => {
    const admin = await makeUser("admin");
    const c = await postAs(admin);
    for (let i = 0; i < 4; i++) await act(await makeUser("user"), () => reportComment(c.id, "spam"));
    expect(await status(c.id)).toBe("visible");
  });

  it("lets an admin dismiss reports, or restore a comment the reports hid", async () => {
    const author = await makeUser("user");
    const c = await postAs(author);
    for (let i = 0; i < 3; i++) await act(await makeUser("user"), () => reportComment(c.id, "offtopic"));
    expect(await status(c.id)).toBe("hidden");
    const admin = await makeUser("admin");
    await act(admin, () => resolveReports(form({ id: String(c.id), action: "restore" })));
    expect(await status(c.id)).toBe("visible");
    expect(await count("SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ? AND resolved = 0", c.id)).toBe(0);
    // Resolved reports no longer count toward the threshold: two fresh ones do not re-hide it.
    for (let i = 0; i < 2; i++) await act(await makeUser("user"), () => reportComment(c.id, "spam"));
    expect(await status(c.id)).toBe("visible");
  });

  it("restricts the report queue actions to admins", async () => {
    const c = await postAs(await makeUser("user"));
    await act(await makeUser("user"), () => reportComment(c.id, "spam"));
    const member = await makeUser("user");
    expect(await redirectOf(() => act(member, () => resolveReports(form({ id: String(c.id), action: "dismiss" }))))).toBe("/");
    expect(await count("SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ? AND resolved = 0", c.id)).toBe(1);
  });
});

describe("pinning", () => {
  it("is for admins, top-level visible comments, one per tape", async () => {
    const admin = await makeUser("admin");
    const member = await makeUser("user");
    const a = await postAs(member);
    const b = await postAs(member);
    const reply = await postAs(member, { parentId: a.id });
    const pending = await postAs(member, { kind: "theory" });

    expect(await redirectOf(() => act(member, () => pinComment(a.id, true)))).toBe("/");
    expect(await redirectOf(() => act(null, () => pinComment(a.id, true)))).toBe("/login?next=/admin");

    expect(await act(admin, () => pinComment(a.id, true))).toEqual({ ok: true, pinnedId: a.id });
    expect(await act(admin, () => pinComment(b.id, true))).toEqual({ ok: true, pinnedId: b.id });
    const pinned = (await getThread(1, null)).filter((x) => x.pinned).map((x) => x.id);
    expect(pinned).toEqual([b.id]); // the first one was unpinned

    expect((await act(admin, () => pinComment(reply.id, true))).ok).toBe(false);
    expect((await act(admin, () => pinComment(pending.id, true))).ok).toBe(false);
    expect(await act(admin, () => pinComment(b.id, false))).toEqual({ ok: true, pinnedId: null });
    expect((await getThread(1, null)).some((x) => x.pinned)).toBe(false);
  });
});

describe("replies to you", () => {
  it("lists other people's replies, not your own, and counts the unread ones", async () => {
    const me = await makeUser("user");
    const them = await makeUser("user");
    const mine = await postAs(me);
    await postAs(me, { parentId: mine.id }); // answering myself does not notify me
    expect(await countUnreadReplies(me.id)).toBe(0);
    const r1 = await postAs(them, { parentId: mine.id });
    const r2 = await postAs(them, { parentId: mine.id });
    expect(await countUnreadReplies(me.id)).toBe(2);
    const list = await getRepliesTo(me.id);
    expect(list.map((x) => x.id).sort()).toEqual([r1.id, r2.id].sort());
    expect(list.every((x) => x.unread === 1)).toBe(true);
    expect(list[0].parent_body).toBe(mine.body);
    expect(await countUnreadReplies(them.id)).toBe(0);
  });

  it("clears the unread count when marked as read", async () => {
    const me = await makeUser("user");
    const mine = await postAs(me);
    await postAs(await makeUser("user"), { parentId: mine.id });
    expect(await countUnreadReplies(me.id)).toBe(1);
    expect(await act(me, () => markRepliesRead())).toEqual({ ok: true });
    expect(await countUnreadReplies(me.id)).toBe(0);
    expect((await getRepliesTo(me.id))[0].unread).toBe(0);
    expect((await act(null, () => markRepliesRead())).ok).toBe(false);
  });

  it("does not report replies that are hidden or removed", async () => {
    const me = await makeUser("user");
    const mine = await postAs(me);
    const reply = await postAs(await makeUser("user"), { parentId: mine.id });
    await sql.run("UPDATE comments SET status = 'hidden' WHERE id = ?", reply.id);
    expect(await countUnreadReplies(me.id)).toBe(0);
  });
});

describe("cleanup", () => {
  it("deleting a user removes their comments, keeps a placeholder where others replied, and drops their votes", async () => {
    const admin = await makeUser("admin");
    const gone = await makeUser("user");
    const friend = await makeUser("user");
    const parent = await postAs(gone);
    const leaf = await postAs(gone);
    const reply = await postAs(friend, { parentId: parent.id });
    await act(friend, () => voteComment(leaf.id, 1));
    await act(gone, () => voteComment(reply.id, 1));
    await act(friend, () => reportComment(parent.id, "spam"));

    await act(admin, () => updateUser(form({ id: String(gone.id), action: "delete" })));

    expect(await sql.get("SELECT 1 FROM users WHERE id = ?", gone.id)).toBeUndefined();
    expect(await sql.get("SELECT 1 FROM comments WHERE id = ?", leaf.id)).toBeUndefined(); // no replies: gone
    const placeholder = (await getComment(parent.id, null))!;
    expect(placeholder).toMatchObject({ deleted: true, username: "[deleted]", body: "" });
    expect((await getComment(reply.id, null))!.parentId).toBe(parent.id); // the friend's reply survives under it
    expect(await count("SELECT COUNT(*) AS n FROM comment_votes WHERE user_id = ? OR comment_id = ?", gone.id, leaf.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ?", parent.id)).toBe(0);
    expect(await sql.get("SELECT 1 FROM comments WHERE user_id = ?", gone.id)).toBeUndefined(); // nothing still points at them
  });

  it("deleting a tape removes its comments, votes and reports", async () => {
    const admin = await makeUser("admin");
    const author = await makeUser("user");
    // a throwaway tape so the real ones stay intact for other tests
    await redirectOf(() => act(admin, () => saveEntity("tapes", form({ id: "new", title: "Doomed tape", release_date: "2031-01-01", runtime: "1:00", confidence: "unknown", published: "on" }))));
    const tapeId = (await sql.get<{ id: number }>("SELECT id FROM tapes WHERE title = 'Doomed tape'"))!.id;
    const c = await postAs(author, { tapeId });
    await act(await makeUser("user"), () => voteComment(c.id, 1));
    await act(await makeUser("user"), () => reportComment(c.id, "spam"));
    await redirectOf(() => act(admin, () => deleteEntity("tapes", form({ id: String(tapeId) }))));
    expect(await count("SELECT COUNT(*) AS n FROM comments WHERE tape_id = ?", tapeId)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM comment_votes WHERE comment_id = ?", c.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ?", c.id)).toBe(0);
  });

  it("moderator delete uses the same rules as an author delete", async () => {
    const admin = await makeUser("admin");
    const a = await makeUser("user");
    const parent = await postAs(a);
    const reply = await postAs(await makeUser("user"), { parentId: parent.id });
    await act(admin, () => moderateComment(form({ id: String(parent.id), action: "delete", tape_id: "1" })));
    expect((await getComment(parent.id, null))!.deleted).toBe(true); // kept as a placeholder because of the reply
    await act(admin, () => moderateComment(form({ id: String(reply.id), action: "delete", tape_id: "1" })));
    expect(await sql.get("SELECT 1 FROM comments WHERE id = ?", parent.id)).toBeUndefined();
  });
});
