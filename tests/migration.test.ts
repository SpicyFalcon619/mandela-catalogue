import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

// Builds a database the way it looked before the youtube_url column existed, then lets the app open it.
// This file must not import the db module until the old file is in place (db() is a per-process singleton).
const OLD_TAPES = `
CREATE TABLE tapes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  release_date TEXT NOT NULL,
  runtime TEXT NOT NULL,
  is_main INTEGER NOT NULL DEFAULT 0,
  inworld_label TEXT NOT NULL DEFAULT '',
  inworld_sort REAL,
  confidence TEXT NOT NULL DEFAULT 'unknown',
  threads TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1
);`;

describe("adding youtube_url to an existing database", () => {
  it("adds the column, links the original tapes, and leaves edited or added ones alone", async () => {
    const old = new Database(process.env.DATABASE_PATH!);
    old.exec(OLD_TAPES);
    const ins = old.prepare("INSERT INTO tapes (id, title, release_date, runtime) VALUES (?,?,?,?)");
    ins.run(1, "overthrone", "2021-06-09", "4:01"); // untouched original
    ins.run(2, "Vol. 1 (renamed by an admin)", "2021-08-09", "15:09"); // same id, edited title
    ins.run(40, "A tape the admin added", "2030-01-01", "1:00"); // not in the seed
    old.close();

    const { sql } = await import("@/lib/db");
    const rows = await sql.all<{ id: number; youtube_url: string }>("SELECT id, youtube_url FROM tapes ORDER BY id");
    expect(rows).toEqual([
      { id: 1, youtube_url: "https://www.youtube.com/watch?v=q0EpOiu8YkI" },
      { id: 2, youtube_url: "" },
      { id: 40, youtube_url: "" },
    ]);
    // The column is there for new inserts too.
    await sql.run("INSERT INTO tapes (title, release_date, runtime, youtube_url) VALUES ('x','2031-01-01','1:00','https://youtu.be/abcdefghijk')");
  });

  it("does not run again or overwrite a link an admin set afterwards", async () => {
    const { sql, getDb } = await import("@/lib/db");
    await sql.run("UPDATE tapes SET youtube_url = 'https://youtu.be/custom000000' WHERE id = 1");
    // Re-running the backfill (as a restart would not, but a repeat of the guard must be harmless) keeps the admin's value.
    const { backfillYoutubeLinks } = await import("@/lib/seed");
    await backfillYoutubeLinks(await getDb());
    expect((await sql.get<{ youtube_url: string }>("SELECT youtube_url FROM tapes WHERE id = 1"))!.youtube_url).toBe("https://youtu.be/custom000000");
  });
});
