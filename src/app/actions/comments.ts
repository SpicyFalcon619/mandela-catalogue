"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { tooMany } from "@/lib/rate";
import { getComment, removeComment, replyPlacement } from "@/lib/comments";
import {
  MAX_BODY,
  MIN_BODY,
  REPORT_HIDE_THRESHOLD,
  REPORT_REASON_IDS,
  type CommentDTO,
  type CommentKind,
} from "@/lib/comment-types";

// Every action re-checks who is calling and what they may do; the buttons in the UI are only a convenience.
// A "use server" file may only export async functions, so the shared types live in "@/lib/comment-types".

const KINDS: readonly string[] = ["comment", "theory", "correction"];

export type ActionError = { ok: false; error: string; body?: string; kind?: string; spoiler?: boolean };
export type SaveResult = { ok: true; comment: CommentDTO; message: string } | ActionError;
export type VoteResult = { ok: true; ups: number; downs: number; myVote: -1 | 0 | 1 } | ActionError;
export type DeleteResult = { ok: true; removed: "deleted" | "soft" } | ActionError;
export type ReportResult = { ok: true; hidden: boolean; message: string } | ActionError;
export type SimpleResult = { ok: true } | ActionError;

const id = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n > 0 ? n : 0);
const clean = (s: unknown) => (typeof s === "string" ? s.trim() : "");

export async function postComment(input: {
  tapeId: number;
  kind: CommentKind;
  body: string;
  parentId?: number | null;
  spoiler?: boolean;
}): Promise<SaveResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to post." };
  const body = clean(input.body);
  const parentId = input.parentId ? id(input.parentId) : 0;
  // Replies are always plain comments; only top-level posts can be theories or corrections.
  const kind = parentId ? "comment" : clean(input.kind) || "comment";
  const keep = (error: string): ActionError => ({ ok: false, error, body, kind, spoiler: !!input.spoiler });

  if (!KINDS.includes(kind)) return keep("Unknown post type.");
  const settings = await getSettings();
  if (kind === "comment" && settings.comments_enabled !== "1") return keep("Comments are turned off.");
  if (kind !== "comment" && settings.submissions_enabled !== "1") return keep("Theories and corrections are turned off.");
  if (body.length < MIN_BODY) return keep("Write a little more.");
  if (body.length > MAX_BODY) return keep("Keep it under 1,500 characters.");
  const tapeId = id(input.tapeId);
  if (!tapeId || !(await sql.get("SELECT 1 FROM tapes WHERE id = ? AND published = 1", tapeId))) return keep("That tape does not exist.");

  let placement: { parentId: number | null; depth: number } = { parentId: null, depth: 0 };
  if (parentId) {
    const parent = await sql.get<{ id: number; tape_id: number; parent_id: number | null; depth: number; status: string; deleted: number }>(
      "SELECT id, tape_id, parent_id, depth, status, deleted FROM comments WHERE id = ?",
      parentId,
    );
    if (!parent || parent.tape_id !== tapeId || parent.status !== "visible" || parent.deleted) return keep("That comment is no longer there.");
    placement = replyPlacement(parent);
  }

  if (await sql.get("SELECT 1 FROM comments WHERE user_id = ? AND tape_id = ? AND body = ? AND created_at > datetime('now', '-10 minutes')", user.id, tapeId, body)) {
    return keep("You already posted that.");
  }
  if (await tooMany(`post:${user.id}`, 5, 60 * 1000)) return keep("Slow down a little.");

  // Comments and replies appear straight away. Theories and corrections wait for an admin, except admins' own.
  const status = kind === "comment" || user.role === "admin" ? "visible" : "pending";
  const res = await sql.run(
    "INSERT INTO comments (tape_id, user_id, kind, body, status, parent_id, depth, spoiler) VALUES (?,?,?,?,?,?,?,?)",
    tapeId,
    user.id,
    kind,
    body,
    status,
    placement.parentId,
    placement.depth,
    input.spoiler ? 1 : 0,
  );
  const comment = await getComment(res.lastId, user);
  if (!comment) return keep("Could not save that. Try again.");
  return { ok: true, comment, message: status === "pending" ? "Thanks. An admin will review it before it shows." : "Posted." };
}

export async function editComment(input: { id: number; body: string; spoiler?: boolean }): Promise<SaveResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const body = clean(input.body);
  const keep = (error: string): ActionError => ({ ok: false, error, body, spoiler: !!input.spoiler });
  const cid = id(input.id);
  const row = cid
    ? await sql.get<{ user_id: number; kind: string; status: string; deleted: number; body: string; spoiler: number }>(
        "SELECT user_id, kind, status, deleted, body, spoiler FROM comments WHERE id = ?",
        cid,
      )
    : undefined;
  if (!row || row.deleted || row.user_id !== user.id || row.status === "hidden") return keep("You cannot edit that comment.");
  if (body.length < MIN_BODY) return keep("Write a little more.");
  if (body.length > MAX_BODY) return keep("Keep it under 1,500 characters.");
  const spoiler = input.spoiler ? 1 : 0;
  if (body === row.body && spoiler === row.spoiler) {
    const same = await getComment(cid, user);
    return same ? { ok: true, comment: same, message: "No changes." } : keep("That comment is gone.");
  }
  if (await tooMany(`edit:${user.id}`, 10, 60 * 1000)) return keep("Slow down a little.");
  // An approved theory or correction goes back to review when it is changed, so it cannot be swapped after approval.
  const needsReview = row.kind !== "comment" && user.role !== "admin" && row.status === "visible";
  await sql.run(
    "UPDATE comments SET body = ?, spoiler = ?, edited_at = datetime('now'), status = ? WHERE id = ?",
    body,
    spoiler,
    needsReview ? "pending" : row.status,
    cid,
  );
  const comment = await getComment(cid, user);
  if (!comment) return keep("That comment is gone.");
  return { ok: true, comment, message: needsReview ? "Saved. An admin will review the change before it shows again." : "Saved." };
}

/** Authors can delete their own comments; admins can delete anyone's. */
export async function deleteComment(commentId: number): Promise<DeleteResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const cid = id(commentId);
  const row = cid ? await sql.get<{ user_id: number; tape_id: number }>("SELECT user_id, tape_id FROM comments WHERE id = ?", cid) : undefined;
  if (!row || (row.user_id !== user.id && user.role !== "admin")) return { ok: false, error: "You cannot delete that comment." };
  const removed = await removeComment(cid);
  if (removed === "missing") return { ok: false, error: "That comment is gone." };
  revalidatePath(`/tapes/${row.tape_id}`);
  return { ok: true, removed };
}

/** value: 1 up, -1 down, 0 to take the vote back. One vote per person per comment; no voting on your own. */
export async function voteComment(commentId: number, value: number): Promise<VoteResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to vote." };
  if (value !== 1 && value !== -1 && value !== 0) return { ok: false, error: "Unknown vote." };
  const cid = id(commentId);
  const row = cid ? await sql.get<{ user_id: number; status: string; deleted: number }>("SELECT user_id, status, deleted FROM comments WHERE id = ?", cid) : undefined;
  if (!row || row.status !== "visible" || row.deleted) return { ok: false, error: "That comment is no longer there." };
  if (row.user_id === user.id) return { ok: false, error: "You cannot vote on your own comment." };
  if (await tooMany(`vote:${user.id}`, 60, 60 * 1000)) return { ok: false, error: "Slow down a little." };
  if (value === 0) await sql.run("DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?", cid, user.id);
  else {
    await sql.run(
      "INSERT INTO comment_votes (comment_id, user_id, value) VALUES (?, ?, ?) ON CONFLICT(comment_id, user_id) DO UPDATE SET value = excluded.value",
      cid,
      user.id,
      value,
    );
  }
  const c = await getComment(cid, user);
  if (!c) return { ok: false, error: "That comment is gone." };
  return { ok: true, ups: c.ups, downs: c.downs, myVote: c.myVote };
}

/** Reports go to the moderation queue. Enough different people reporting hides the comment until an admin looks. */
export async function reportComment(commentId: number, reason: string): Promise<ReportResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to report." };
  if (!REPORT_REASON_IDS.includes(reason)) return { ok: false, error: "Pick a reason." };
  const cid = id(commentId);
  const row = cid
    ? await sql.get<{ user_id: number; status: string; deleted: number; role: string | null }>(
        "SELECT c.user_id, c.status, c.deleted, u.role FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?",
        cid,
      )
    : undefined;
  if (!row || row.deleted || row.status === "hidden") return { ok: false, error: "That comment is no longer there." };
  if (row.user_id === user.id) return { ok: false, error: "You cannot report your own comment." };
  if (await tooMany(`report:${user.id}`, 10, 60 * 60 * 1000)) return { ok: false, error: "You have reported a lot just now. Try again later." };
  await sql.run("INSERT OR IGNORE INTO comment_reports (comment_id, user_id, reason) VALUES (?, ?, ?)", cid, user.id, reason);
  const open = (await sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ? AND resolved = 0", cid))?.n ?? 0;
  let hidden = false;
  if (open >= REPORT_HIDE_THRESHOLD && row.status === "visible" && row.role !== "admin") {
    await sql.run("UPDATE comments SET status = 'hidden' WHERE id = ? AND status = 'visible'", cid);
    hidden = true;
  }
  return { ok: true, hidden, message: "Thanks. A moderator will take a look." };
}

export async function markRepliesRead(): Promise<SimpleResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  await sql.run("UPDATE users SET replies_seen_at = datetime('now') WHERE id = ?", user.id);
  revalidatePath("/account");
  return { ok: true };
}
