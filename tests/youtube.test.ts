import { beforeEach, describe, expect, it } from "vitest";
import { saveEntity } from "@/app/actions/admin";
import { getTapes } from "@/lib/content";
import { db } from "@/lib/db";
import { youtubeHref } from "@/lib/youtube";
import { form, makeUser, redirectOf, resetRequest, signInAs } from "./helpers";

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

describe("seeded links", () => {
  it("gives every one of the 19 tapes its own valid YouTube watch link", () => {
    const tapes = getTapes();
    expect(tapes).toHaveLength(19);
    const urls = tapes.map((t) => t.youtubeUrl);
    for (const [i, u] of urls.entries()) expect(u, tapes[i].title).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/);
    expect(new Set(urls).size).toBe(19);
  });

  it("lists the official playlist among the sources", () => {
    const row = db().prepare("SELECT url FROM sources WHERE url LIKE 'https://www.youtube.com/playlist?list=%'").get() as { url: string } | undefined;
    expect(row?.url).toBe("https://www.youtube.com/playlist?list=PLkk6ZuwrqcsG1CFuI_kjfOVPunfuJEHwj");
  });
});

describe("admin tape form", () => {
  beforeEach(resetRequest);
  const tape = (extra: Record<string, string>) =>
    form({ id: "new", title: "YT test tape", release_date: "2030-01-01", runtime: "1:00", confidence: "unknown", ...extra });

  it("rejects links that are not YouTube", async () => {
    await signInAs(makeUser("admin").id);
    const before = (db().prepare("SELECT COUNT(*) n FROM tapes").get() as { n: number }).n;
    for (const bad of ["javascript:alert(1)", "https://evil.example/x", "http://www.youtube.com/watch?v=abc"]) {
      expect(await redirectOf(() => saveEntity("tapes", tape({ youtube_url: bad }))), bad).toMatch(/^\/admin\/tapes\/new\?error=/);
    }
    expect((db().prepare("SELECT COUNT(*) n FROM tapes").get() as { n: number }).n).toBe(before);
  });

  it("accepts a YouTube link, or none", async () => {
    await signInAs(makeUser("admin").id);
    expect(await redirectOf(() => saveEntity("tapes", tape({ youtube_url: "https://youtu.be/abcdefghijk" })))).toBe("/admin/tapes?saved=1");
    expect(await redirectOf(() => saveEntity("tapes", tape({ youtube_url: "" })))).toBe("/admin/tapes?saved=1");
    const row = db().prepare("SELECT youtube_url FROM tapes WHERE title = 'YT test tape' ORDER BY id").all() as { youtube_url: string }[];
    expect(row.map((r) => r.youtube_url)).toEqual(["https://youtu.be/abcdefghijk", ""]);
  });

  it("never turns a bad value already in the database into a link", () => {
    db().prepare("INSERT INTO tapes (title, release_date, runtime, youtube_url) VALUES ('Bad link', '2031-01-01', '1:00', 'javascript:alert(1)')").run();
    expect(getTapes().find((t) => t.title === "Bad link")?.youtubeUrl).toBe("");
  });
});
