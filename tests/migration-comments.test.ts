import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

// A database as it was before threads, votes and reports: comments and users without the new columns, with real
// rows in them. The file must be in place before the app's db module is first used (it is a per-process singleton).
const OLD = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', prefs TEXT NOT NULL DEFAULT '{}', banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tape_id INTEGER NOT NULL REFERENCES tapes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'comment', body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'visible',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_comments_tape ON comments(tape_id, status);`;

describe("upgrading a database that has old-format comments", () => {
  it("adds the thread columns and tables, and keeps every existing comment working", async () => {
    const old = new Database(process.env.DATABASE_PATH!);
    old.pragma("foreign_keys = OFF"); // the old rows point at tapes that the upgrade creates afterwards
    old.exec(OLD);
    old.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'oldtimer', 'x')").run();
    old.prepare("INSERT INTO comments (tape_id, user_id, kind, body, status) VALUES (1, 1, 'comment', 'written long ago', 'visible')").run();
    old.prepare("INSERT INTO comments (tape_id, user_id, kind, body, status) VALUES (1, 1, 'theory', 'an old pending theory', 'pending')").run();
    old.close();

    const { sql } = await import("@/lib/db");
    const cols = async (t: string) => (await sql.all<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
    expect(await cols("comments")).toEqual(expect.arrayContaining(["parent_id", "depth", "edited_at", "deleted", "pinned", "spoiler"]));
    expect(await cols("users")).toContain("replies_seen_at");
    expect(await cols("comment_votes")).toEqual(expect.arrayContaining(["comment_id", "user_id", "value"]));
    expect(await cols("comment_reports")).toEqual(expect.arrayContaining(["comment_id", "user_id", "reason", "resolved"]));
    const idx = (await sql.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'")).map((i) => i.name);
    expect(idx).toEqual(expect.arrayContaining(["idx_comments_parent", "idx_comments_user", "idx_reports_open"]));

    // Existing rows take the defaults: top-level, not removed, not pinned, no spoiler flag.
    const rows = await sql.all<Record<string, unknown>>("SELECT body, parent_id, depth, deleted, pinned, spoiler, edited_at FROM comments ORDER BY id");
    expect(rows).toEqual([
      { body: "written long ago", parent_id: null, depth: 0, deleted: 0, pinned: 0, spoiler: 0, edited_at: null },
      { body: "an old pending theory", parent_id: null, depth: 0, deleted: 0, pinned: 0, spoiler: 0, edited_at: null },
    ]);
    expect((await sql.get<{ replies_seen_at: string }>("SELECT replies_seen_at FROM users WHERE id = 1"))!.replies_seen_at).toBe("");

    // And the new code reads and extends them.
    const { getThread } = await import("@/lib/comments");
    const thread = await getThread(1, { id: 1, role: "user" });
    expect(thread.map((c) => [c.body, c.parentId, c.depth, c.status])).toEqual([
      ["written long ago", null, 0, "visible"],
      ["an old pending theory", null, 0, "pending"], // the author still sees their own pending post
    ]);
    expect((await getThread(1, null)).map((c) => c.body)).toEqual(["written long ago"]);
  });

  it("is safe to run again", async () => {
    const { getDb } = await import("@/lib/db");
    await expect(getDb()).resolves.toBeTruthy();
  });
});
