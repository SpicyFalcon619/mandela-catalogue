import { describe, expect, it } from "vitest";
import { getSettings } from "@/lib/content";
import { sql } from "@/lib/db";
import { searchSite, snippet } from "@/lib/search";
import { makeUser } from "./helpers";

const find = async (q: string) => searchSite(q, await getSettings());
const ids = (g: Awaited<ReturnType<typeof find>>) => g.map((x) => x.id);
const setSetting = (k: string, v: string) =>
  sql.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", k, v);

describe("snippet", () => {
  const text = "The quick brown fox jumps over the lazy dog while the Intruder watches from the television in the next room.";
  it("returns short text as is", () => expect(snippet(["Short text"], "text")).toBe("Short text"));
  it("centres a window on the match and marks the cut ends", () => {
    const s = snippet([text], "intruder", 50);
    expect(s.toLowerCase()).toContain("intruder");
    expect(s.length).toBeLessThanOrEqual(52);
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
  });
  it("strips formatting marks and extra whitespace", () => {
    expect(snippet(["**Bold**  and *italic* and [a link](https://example.com)"], "bold")).toBe("Bold and italic and a link");
  });
  it("uses the first field that actually contains the match", () => {
    expect(snippet(["nothing here", "but the Gabriel line does"], "gabriel")).toBe("but the Gabriel line does");
  });
});

describe("searching the site", () => {
  it("finds content in tapes and the field guide, whatever the case", async () => {
    for (const q of ["gabriel", "GABRIEL", "Gabriel"]) {
      const g = await find(q);
      expect(ids(g), q).toEqual(expect.arrayContaining(["tapes", "guide"]));
    }
    const tapes = (await find("Presto")).find((x) => x.id === "tapes")!;
    expect(tapes.hits.map((h) => h.title)).toContain("Presto");
    expect(tapes.hits[0].href).toMatch(/^\/tapes\/\d+$/);
  });

  it("treats wildcard characters literally", async () => {
    expect(await find("%%")).toEqual([]);
    expect(await find("Gab_iel")).toEqual([]); // "_" would otherwise match any letter and find Gabriel
    expect(await find("Gab%el")).toEqual([]);
    expect(await find("100%")).toEqual([]);
  });

  it("returns nothing for a word that is not there", async () => {
    expect(await find("zzzzqqqq")).toEqual([]);
  });

  it("does not search sections an admin has switched off", async () => {
    try {
      await setSetting("show_guide", "0");
      await setSetting("show_files", "0");
      const g = await find("Gabriel");
      expect(ids(g)).not.toContain("guide");
      expect(ids(g)).not.toContain("files");
      expect(ids(g)).toContain("tapes");
    } finally {
      await setSetting("show_guide", "1");
      await setSetting("show_files", "1");
    }
  });

  it("searches the discussion but only what visitors can see", async () => {
    const u = await makeUser("user");
    const add = (body: string, status: string, extra = "") =>
      sql.run(`INSERT INTO comments (tape_id, user_id, kind, body, status${extra ? ", " + extra.split("=")[0] : ""}) VALUES (1, ?, 'comment', ?, ?${extra ? ", " + extra.split("=")[1] : ""})`, u.id, body, status);
    await add("searchable comment about the Zephyrine thing", "visible");
    await add("pending Zephyrine thing", "pending");
    await add("hidden Zephyrine thing", "hidden");
    await add("removed Zephyrine thing", "visible", "deleted=1");
    await add("secret Zephyrine ending revealed", "visible", "spoiler=1");
    const group = (await find("Zephyrine")).find((x) => x.id === "comments")!;
    const snippets = group.hits.map((h) => h.snippet).join(" | ");
    expect(snippets).toContain("searchable comment");
    expect(snippets).not.toMatch(/pending|hidden|removed/);
    expect(snippets).not.toContain("secret Zephyrine ending"); // a spoiler comment is not quoted in results
    expect(snippets).toMatch(/marked as containing spoilers/);
    expect(group.hits.find((h) => h.snippet.includes("searchable"))!.href).toMatch(/^\/tapes\/1#c\d+$/);
  });

  it("finds a comment by its author's name", async () => {
    const u = await makeUser("user");
    await sql.run("INSERT INTO comments (tape_id, user_id, kind, body, status) VALUES (2, ?, 'comment', 'an ordinary remark', 'visible')", u.id);
    const g = (await find(u.username)).find((x) => x.id === "comments");
    expect(g?.hits.some((h) => h.title.startsWith(u.username))).toBe(true);
  });

  it("caps each group", async () => {
    const u = await makeUser("user");
    for (let i = 0; i < 20; i++) await sql.run("INSERT INTO comments (tape_id, user_id, kind, body, status) VALUES (3, ?, 'comment', ?, 'visible')", u.id, `many Quillfeather matches ${i}`);
    const g = (await find("Quillfeather")).find((x) => x.id === "comments")!;
    expect(g.hits).toHaveLength(12);
  });
});
