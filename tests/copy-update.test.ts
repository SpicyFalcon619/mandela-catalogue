import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/defaults";

// An existing database whose wording is still the old default (credit line) or has been edited (sources intro).
const OLD_CREDIT = 'Fan-made explainer. Not affiliated with Alex Kister or the series. The Mandela Catalogue, its footage, characters and designs are © Alex Kister. This site contains none of them; it links to the originals.';

describe("updating stored wording about the footage", () => {
  it("replaces the old default, keeps what an admin edited, and new databases get the new text", async () => {
    const old = new Database(process.env.DATABASE_PATH!);
    old.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    old.prepare("INSERT INTO settings (key, value) VALUES ('credit_line', ?)").run(OLD_CREDIT);
    old.prepare("INSERT INTO settings (key, value) VALUES ('sources_lede', ?)").run("My own words about the sources.");
    old.close();

    const { sql } = await import("@/lib/db");
    const get = async (k: string) => (await sql.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", k))!.value;
    expect(await get("credit_line")).toBe(DEFAULT_SETTINGS.credit_line);
    expect(await get("credit_line")).toContain("videos play from YouTube");
    expect(await get("credit_line")).not.toContain("contains none of them");
    expect(await get("sources_lede")).toBe("My own words about the sources.");
    // The credit to Alex Kister must stay in the footer text.
    expect(await get("credit_line")).toMatch(/Alex Kister/);
  });

  it("the defaults no longer claim the site has no footage", () => {
    for (const v of [DEFAULT_SETTINGS.credit_line, DEFAULT_SETTINGS.sources_lede]) {
      expect(v).not.toMatch(/contains none of them|contains no frames/);
      expect(v).toContain("YouTube");
    }
  });
});
