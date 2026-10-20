import { sql, type Arg, type Stmt } from "./db";
import { MAX_DEPTH, type CommentDTO, type CommentKind, type CommentStatus } from "./comment-types";

/** Data access for the discussion system. Server only (it talks to the database). */

export type Viewer = { id: number; role: "user" | "admin" } | null;

type Row = {
  id: number; parent_id: number | null; depth: number; kind: string; body: string; status: string; created_at: string;
  edited_at: string | null; deleted: number; pinned: number; spoiler: number; user_id: number; username: string | null;
  role: string | null; ups: number; downs: number; my_vote: number;
};

// Votes are counted from the votes table on every read, so the numbers can never drift from the data.
const SELECT = `
SELECT c.id, c.parent_id, c.depth, c.kind, c.body, c.status, c.created_at, c.edited_at, c.deleted, c.pinned, c.spoiler, c.user_id,
       u.username, u.role,
       COALESCE(v.ups, 0) AS ups, COALESCE(v.downs, 0) AS downs, COALESCE(mv.value, 0) AS my_vote
FROM comments c
LEFT JOIN users u ON u.id = c.user_id
LEFT JOIN (
  SELECT comment_id,
         SUM(CASE WHEN value > 0 THEN 1 ELSE 0 END) AS ups,
         SUM(CASE WHEN value < 0 THEN 1 ELSE 0 END) AS downs
  FROM comment_votes GROUP BY comment_id
) v ON v.comment_id = c.id
LEFT JOIN comment_votes mv ON mv.comment_id = c.id AND mv.user_id = ?`;

const asKind = (k: string): CommentKind => (k === "theory" || k === "correction" ? k : "comment");
const asStatus = (s: string): CommentStatus => (s === "pending" || s === "hidden" ? s : "visible");

export function toDTO(r: Row): CommentDTO {
  const gone = !!r.deleted;
  return {
    id: r.id,
    parentId: r.parent_id,
    depth: r.depth,
    kind: asKind(r.kind),
    // A removed comment keeps its place in the thread but nothing of its content or author.
    body: gone ? "" : r.body,
    status: asStatus(r.status),
    createdAt: r.created_at,
    editedAt: gone ? null : r.edited_at,
    deleted: gone,
    pinned: gone ? false : !!r.pinned,
    spoiler: gone ? false : !!r.spoiler,
    userId: gone ? 0 : r.user_id,
    username: gone ? "[deleted]" : r.username ?? "[deleted]",
    role: !gone && r.role === "admin" ? "admin" : "user",
    ups: gone ? 0 : r.ups,
    downs: gone ? 0 : r.downs,
    myVote: gone ? 0 : r.my_vote > 0 ? 1 : r.my_vote < 0 ? -1 : 0,
  };
}

/** Every comment on a tape that this viewer may see: visible ones, plus their own posts waiting for review. */
export async function getThread(tapeId: number, viewer: Viewer): Promise<CommentDTO[]> {
  const me = viewer?.id ?? -1;
  const rows = await sql.all<Row>(
    `${SELECT}
     WHERE c.tape_id = ? AND (c.status = 'visible' OR (c.status = 'pending' AND c.user_id = ?))
     ORDER BY c.created_at, c.id LIMIT 800`,
    me,
    tapeId,
    me,
  );
  return rows.map(toDTO);
}

export async function getComment(id: number, viewer: Viewer): Promise<CommentDTO | null> {
  const row = await sql.get<Row>(`${SELECT} WHERE c.id = ?`, viewer?.id ?? -1, id);
  return row ? toDTO(row) : null;
}

/** Visible, non-removed comments per tape (replies included), for the counts shown on the home page. */
export async function getCommentCounts(): Promise<Record<number, number>> {
  const rows = await sql.all<{ tape_id: number; n: number }>(
    "SELECT tape_id, COUNT(*) AS n FROM comments WHERE status = 'visible' AND deleted = 0 GROUP BY tape_id",
  );
  return Object.fromEntries(rows.map((r) => [r.tape_id, r.n]));
}

/** The depth a reply to `parent` gets, and which comment it really attaches to (deep threads stay at MAX_DEPTH). */
export function replyPlacement(parent: { id: number; parent_id: number | null; depth: number }): { parentId: number; depth: number } {
  if (parent.depth >= MAX_DEPTH) return { parentId: parent.parent_id ?? parent.id, depth: MAX_DEPTH };
  return { parentId: parent.id, depth: parent.depth + 1 };
}

const dropVotesAndReports = (id: number): Stmt[] => [
  { sql: "DELETE FROM comment_votes WHERE comment_id = ?", args: [id] },
  { sql: "DELETE FROM comment_reports WHERE comment_id = ?", args: [id] },
];

/**
 * Removes a comment. With replies under it, it stays as an empty "[deleted]" placeholder so the thread still
 * reads; without, it is deleted outright, along with any placeholder above it that has no replies left.
 */
export async function removeComment(id: number): Promise<"deleted" | "soft" | "missing"> {
  const row = await sql.get<{ parent_id: number | null }>("SELECT parent_id FROM comments WHERE id = ?", id);
  if (!row) return "missing";
  const kids = (await sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM comments WHERE parent_id = ?", id))?.n ?? 0;
  if (kids > 0) {
    await sql.batch([
      { sql: "UPDATE comments SET deleted = 1, body = '', pinned = 0, spoiler = 0 WHERE id = ?", args: [id] },
      ...dropVotesAndReports(id),
    ]);
    return "soft";
  }
  await sql.batch([...dropVotesAndReports(id), { sql: "DELETE FROM comments WHERE id = ?", args: [id] }]);
  let up = row.parent_id;
  while (up !== null) {
    const p = await sql.get<{ deleted: number; parent_id: number | null }>("SELECT deleted, parent_id FROM comments WHERE id = ?", up);
    if (!p || !p.deleted) break;
    const more = (await sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM comments WHERE parent_id = ?", up))?.n ?? 0;
    if (more > 0) break;
    await sql.run("DELETE FROM comments WHERE id = ?", up);
    up = p.parent_id;
  }
  return "deleted";
}

/** Deletes a user and everything of theirs. Comments that have replies become placeholders owned by `heirId`. */
export async function purgeUser(userId: number, heirId: number): Promise<void> {
  const mine = await sql.all<{ id: number }>("SELECT id FROM comments WHERE user_id = ? ORDER BY depth DESC, id DESC", userId);
  for (const { id } of mine) await removeComment(id);
  await sql.batch([
    { sql: "UPDATE comments SET user_id = ? WHERE user_id = ?", args: [heirId, userId] }, // the placeholders left behind
    { sql: "DELETE FROM comment_votes WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM comment_reports WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM users WHERE id = ?", args: [userId] },
  ]);
}

/** Deletes every comment on a tape (used when the tape itself is deleted). */
export async function purgeTapeComments(tapeId: number): Promise<Stmt[]> {
  const ids = "SELECT id FROM comments WHERE tape_id = ?";
  const a: Arg[] = [tapeId];
  return [
    { sql: `DELETE FROM comment_votes WHERE comment_id IN (${ids})`, args: a },
    { sql: `DELETE FROM comment_reports WHERE comment_id IN (${ids})`, args: a },
    { sql: "DELETE FROM comments WHERE tape_id = ?", args: a },
  ];
}

export type ReplyRow = {
  id: number; tape_id: number; body: string; created_at: string; username: string; tape_title: string; parent_body: string; unread: number;
};

/** Replies other people have written to this user's comments, newest first. */
export async function getRepliesTo(userId: number, limit = 40): Promise<ReplyRow[]> {
  return sql.all<ReplyRow>(
    `SELECT r.id, r.tape_id, r.body, r.created_at, u.username, t.title AS tape_title, p.body AS parent_body,
            CASE WHEN r.created_at > (SELECT replies_seen_at FROM users WHERE id = ?) THEN 1 ELSE 0 END AS unread
     FROM comments r
     JOIN comments p ON p.id = r.parent_id
     JOIN users u ON u.id = r.user_id
     JOIN tapes t ON t.id = r.tape_id
     WHERE p.user_id = ? AND r.user_id != ? AND r.status = 'visible' AND r.deleted = 0 AND p.deleted = 0
     ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
    userId,
    userId,
    userId,
    limit,
  );
}

export async function countUnreadReplies(userId: number): Promise<number> {
  const row = await sql.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM comments r
     JOIN comments p ON p.id = r.parent_id
     WHERE p.user_id = ? AND r.user_id != ? AND r.status = 'visible' AND r.deleted = 0 AND p.deleted = 0
       AND r.created_at > (SELECT replies_seen_at FROM users WHERE id = ?)`,
    userId,
    userId,
    userId,
  );
  return row?.n ?? 0;
}
