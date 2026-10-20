import { beforeEach, describe, expect, it } from "vitest";
import { saveEntity } from "@/app/actions/admin";
import { getTapes } from "@/lib/content";
import { sql } from "@/lib/db";
import { youtubeHref, youtubeId } from "@/lib/youtube";
import { count, form, makeUser, redirectOf, resetRequest, signInAs } from "./helpers";

describe("youtubeHref", () => {
  it.each([
    "https://www.youtube.com/watch?v=q0EpOiu8YkI",
    "https://youtube.com/watch?v=q0EpOiu8YkI",
    "https://m.youtube.com/watch?v=q0EpOiu8YkI",
    "https://youtu.be/q0EpOiu8YkI",
    "https://www.youtube.com/playlist?list=PLkk6ZuwrqcsG1CFuI_kjfOVPunfuJEHwj",
  ])("accepts %s", (u) => expect(youtubeHref(u)).toBe(u));

  it("trims whitespace", () => expect(youtubeHref("  https://youtu.be/abc  ")).toBe("https://youtu.be/abc"));

  it.each([
    "",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://www.youtube.com/watch?v=abc", // not https
    "https://evil.example/watch?v=abc",
    "https://youtube.com.evil.example/watch?v=abc",
    "https://www.youtube.com@evil.example/x",
    "https://notyoutube.com/watch?v=abc",
    "https://www.youtube.com/watch?v=abc\" onclick=\"x",
    "https://www.youtube.com/",
    "//www.youtube.com/watch?v=abc",
  ])("rejects %j", (u) => expect(youtubeHref(u)).toBe(""));

  it("rejects non-strings", () => {
    expect(youtubeHref(undefined)).toBe("");
    expect(youtubeHref(null)).toBe("");
    expect(youtubeHref(42)).toBe("");
  });
});

describe("youtubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=q0EpOiu8YkI", "q0EpOiu8YkI"],
    ["https://youtube.com/watch?v=q0EpOiu8YkI&t=30s", "q0EpOiu8YkI"],
    ["https://www.youtube.com/watch?feature=share&v=q0EpOiu8YkI", "q0EpOiu8YkI"],
    ["https://m.youtube.com/watch?v=d--OhKfLcxI", "d--OhKfLcxI"],
    ["https://youtu.be/q0EpOiu8YkI", "q0EpOiu8YkI"],
    ["https://youtu.be/q0EpOiu8YkI?t=9", "q0EpOiu8YkI"],
  ])("reads the id from %s", (url, id) => expect(youtubeId(url)).toBe(id));

  it.each([
    "https://www.youtube.com/playlist?list=PLkk6ZuwrqcsG1CFuI_kjfOVPunfuJEHwj",
    "https://www.youtube.com/watch?v=tooshort",
    "https://www.youtube.com/watch?v=q0EpOiu8YkI_extra_chars",
    "https://evil.example/watch?v=q0EpOiu8YkI",
    "javascript:alert(1)",
    "",
  ])("gives no id for %j", (url) => expect(youtubeId(url)).toBe(""));
});

describe("seeded links", () => {
  it("gives every one of the 19 tapes its own valid YouTube watch link", async () => {
    const tapes = await getTapes();
    expect(tapes).toHaveLength(19);
    const urls = tapes.map((t) => t.youtubeUrl);
    for (const [i, u] of urls.entries()) expect(u, tapes[i].title).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/);
    expect(new Set(urls).size).toBe(19);
  });

  it("has an embeddable id and a channel credit for every tape (two are on the affiliated channel)", async () => {
    const tapes = await getTapes();
    for (const t of tapes) {
      expect(t.youtubeId, t.title).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(t.youtubeUrl, t.title).toContain(t.youtubeId);
      expect(t.youtubeChannel, t.title).not.toBe("");
    }
    const genesis = tapes.filter((t) => t.youtubeChannel === "GENESIS APOCRYPHON").map((t) => t.title);
    expect(genesis).toHaveLength(2);
    expect(genesis.join(" | ")).toMatch(/Story of Easter/);
    expect(genesis.join(" | ")).toMatch(/1_19_09/);
    expect(tapes.filter((t) => t.youtubeChannel === "Alex Kister")).toHaveLength(17);
  });

  it("lists the official playlist among the sources", async () => {
    const row = await sql.get<{ url: string }>("SELECT url FROM sources WHERE url LIKE 'https://www.youtube.com/playlist?list=%'");
    expect(row?.url).toBe("https://www.youtube.com/playlist?list=PLkk6ZuwrqcsG1CFuI_kjfOVPunfuJEHwj");
  });
});

describe("admin tape form", () => {
  beforeEach(resetRequest);
  const tape = (extra: Record<string, string>) =>
    form({ id: "new", title: "YT test tape", release_date: "2030-01-01", runtime: "1:00", confidence: "unknown", ...extra });

  it("rejects links that are not YouTube", async () => {
    await signInAs((await makeUser("admin")).id);
    const before = await count("SELECT COUNT(*) AS n FROM tapes");
    for (const bad of ["javascript:alert(1)", "https://evil.example/x", "http://www.youtube.com/watch?v=abc"]) {
      expect(await redirectOf(() => saveEntity("tapes", tape({ youtube_url: bad }))), bad).toMatch(/^\/admin\/tapes\/new\?error=/);
    }
    expect(await count("SELECT COUNT(*) AS n FROM tapes")).toBe(before);
  });

  it("accepts a YouTube link, or none", async () => {
    await signInAs((await makeUser("admin")).id);
    expect(await redirectOf(() => saveEntity("tapes", tape({ youtube_url: "https://youtu.be/abcdefghijk" })))).toBe("/admin/tapes?saved=1");
    expect(await redirectOf(() => saveEntity("tapes", tape({ youtube_url: "" })))).toBe("/admin/tapes?saved=1");
    const row = await sql.all<{ youtube_url: string }>("SELECT youtube_url FROM tapes WHERE title = 'YT test tape' ORDER BY id");
    expect(row.map((r) => r.youtube_url)).toEqual(["https://youtu.be/abcdefghijk", ""]);
  });

  it("never turns a bad value already in the database into a link", async () => {
    await sql.run("INSERT INTO tapes (title, release_date, runtime, youtube_url) VALUES ('Bad link', '2031-01-01', '1:00', 'javascript:alert(1)')");
    expect((await getTapes()).find((t) => t.title === "Bad link")?.youtubeUrl).toBe("");
  });
});
