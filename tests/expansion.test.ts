import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

// An existing database from before the theories and tape explanations: tapes without a detail column, the old glossary,
// the old fan wiki note, Cognitohazard undated. The app opens it and brings it up to date once.
const OLD_VOCAB = [
  "- **M.A.D.:** named in *Cognitohazard*, where a forum user tries to cause it in another, and in Wikipedia's entry for Mark Heathcliff, where it drives him to suicide. Wikipedia does not say what the letters stand for, and neither does this guide.",
  "- **Cognitohazard:** a general fiction term for information that harms you by being perceived. Also the title of a 2025 installment.",
  "- **T.H.I.N.K. Principle:** the title of a segment in Vol. 1. Wikipedia says the Alternate N appeared in it before attacking Jude in Vol. 5. My sources do not say what it means.",
  "- **Flawed / Complete / Overdriven:** the three assimilation types named on a USDTP tape in *interlude*.",
  "- **Beginner's Bible:** the in-universe children's video series the Bible retellings imitate.",
  "- **GENESIS APOCRYPHON:** an affiliated channel that hosts short clips such as the Easter clips and *1_19_09 221a*.",
  "- **MandelaTECH:** the county company where Dave Lee is a manager. Its closing-down ad opens *Presto*.",
  "- **Bythorne Paranormal Society:** the investigation group Adam, Jonah and Sarah belong to.",
].join("\n");
const OLD_WIKI_NOTE = "Fan wiki with episode pages. Pages did not load when this site was built, so nothing relies on them.";

describe("bringing an existing database up to the theories update", () => {
  it("adds explanations and theories once, updates untouched wording, keeps admin edits", async () => {
    const old = new Database(process.env.DATABASE_PATH!);
    old.exec(`
      CREATE TABLE tapes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, release_date TEXT NOT NULL, runtime TEXT NOT NULL,
        is_main INTEGER NOT NULL DEFAULT 0, inworld_label TEXT NOT NULL DEFAULT '', inworld_sort REAL, confidence TEXT NOT NULL DEFAULT 'unknown',
        threads TEXT NOT NULL DEFAULT '[]', summary TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', youtube_url TEXT NOT NULL DEFAULT '',
        youtube_channel TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE guide (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', aside_title TEXT NOT NULL DEFAULT '',
        aside_body TEXT NOT NULL DEFAULT '', widget TEXT NOT NULL DEFAULT 'none', sort INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE sources (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
        sort INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    const tape = old.prepare("INSERT INTO tapes (id, title, release_date, runtime, inworld_label, confidence) VALUES (?,?,?,?,?,?)");
    tape.run(1, "overthrone", "2021-06-09", "4:01", "Biblical era", "stated");
    tape.run(2, "Renamed by an admin", "2021-08-09", "15:09", "1992", "inferred");
    tape.run(18, "Cognitohazard", "2025-04-04", "7:44", "Undated", "unknown");
    old.prepare("INSERT INTO guide (label, body) VALUES ('Vocabulary', ?)").run(OLD_VOCAB);
    old.prepare("INSERT INTO guide (label, body) VALUES ('Gabriel', 'My own text')").run();
    old.prepare("INSERT INTO sources (title, url, note) VALUES ('Fan wiki', 'https://mandela-catalogue.fandom.com/wiki/The_Mandela_Catalogue', ?)").run(OLD_WIKI_NOTE);
    old.prepare("INSERT INTO settings (key, value) VALUES ('method_note', 'Edited by an admin')").run();
    old.close();

    const { sql } = await import("@/lib/db");

    const details = await sql.all<{ id: number; detail: string }>("SELECT id, detail FROM tapes ORDER BY id");
    expect(details[0].detail).toContain("## In short"); // an original tape: filled in
    expect(details[1].detail).toBe(""); // its title was edited by an admin: left alone
    expect(details[2].detail).toContain("## In short");

    expect((await sql.all("SELECT title FROM theories")).length).toBeGreaterThanOrEqual(10);

    const vocab = (await sql.get<{ body: string }>("SELECT body FROM guide WHERE label = 'Vocabulary'"))!.body;
    expect(vocab).toContain("Metaphysical Awareness Disorder");
    expect(vocab).not.toContain("neither does this guide");
    expect((await sql.get<{ body: string }>("SELECT body FROM guide WHERE label = 'Gabriel'"))!.body).toBe("My own text");

    expect((await sql.get<{ note: string }>("SELECT note FROM sources WHERE url LIKE '%/The_Mandela_Catalogue'"))!.note).toContain("CC BY-SA");
    expect((await sql.all("SELECT 1 FROM sources WHERE url LIKE '%Canonical_System'")).length).toBe(1);
    expect((await sql.get<{ value: string }>("SELECT value FROM settings WHERE key = 'method_note'"))!.value).toBe("Edited by an admin");

    const cog = await sql.get<{ inworld_label: string; confidence: string; inworld_sort: number }>("SELECT inworld_label, confidence, inworld_sort FROM tapes WHERE id = 18");
    expect(cog).toEqual({ inworld_label: "April 2011 (from the chat dates)", confidence: "stated", inworld_sort: 2011 });
  });

  it("does not add the theories again, even after an admin deleted them all", async () => {
    const { sql, getDb } = await import("@/lib/db");
    await sql.run("DELETE FROM theories");
    const { backfillContentExpansion } = await import("@/lib/seed");
    await backfillContentExpansion(await getDb());
    await backfillContentExpansion(await getDb());
    expect((await sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM theories"))!.n).toBe(0);
    expect((await sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM sources WHERE url LIKE '%Canonical_System'"))!.n).toBe(1);
  });
});
