import { describe, expect, it } from "vitest";
import { getCharacters, getGuide, getCards, getTapes } from "@/lib/content";

// Checked against the raw wikitext of https://en.wikipedia.org/wiki/The_Mandela_Catalogue on 2026-10-20.
// If Wikipedia changes, update this table and the seed together, not just one of them.
const EPISODES: [title: string, date: string, runtime: string][] = [
  ["overthrone", "2021-06-09", "4:01"],
  ["The Mandela Catalogue Vol. 1", "2021-08-09", "15:09"],
  ["intruder alert", "2021-08-18", "5:47"],
  ["exhibition", "2021-10-30", "8:32"],
  ["The Mandela Catalogue Vol. 2", "2022-01-18", "20:34"],
  ["The Mandela Catalogue Vol. 333", "2022-06-03", "26:41"],
  ["every day gets brighter", "2022-06-06", "2:26"],
  ["interlude", "2022-09-05", "3:22"],
  ["The Mandela Catalogue Vol. 4", "2022-11-25", "40:53"],
  ['The Beginner\'s Bible "The Story of Easter" Clips circa 1995', "2023-04-08", "2:00"],
  ["mandela catalyst", "2023-04-16", "7:49"],
  ["Presto", "2023-08-12", "6:19"],
  ["1_19_09 221a", "2023-08-22", "0:29"],
  ["2:38", "2024-02-08", "5:57"],
  ["The Mandela Catalogue Vol. 5", "2024-06-24", "33:07"],
  ["Unraveling, Pt. 1", "2024-08-14", "4:17"],
  ["Unraveling, Pt. 2", "2024-10-30", "10:48"],
  ["Cognitohazard", "2025-04-04", "7:44"],
  ["The Mandela Catalogue Vol. 6", "2026-03-13", "26:33"],
];

describe("seed content matches its sources", () => {
  it("lists all 19 videos with the dates and runtimes Wikipedia gives", async () => {
    expect((await getTapes()).map((t) => [t.title, t.releaseDate, t.runtime])).toEqual(EPISODES);
  });

  it("dates Vol. 6 to 2011, as Wikipedia does", async () => {
    const vol6 = (await getTapes()).find((t) => t.title.endsWith("Vol. 6"))!;
    expect(vol6.inworldSort).toBe(2011);
    expect(vol6.confidence).toBe("stated");
  });

  it("defines M.A.D. and the T.H.I.N.K. Principle only as the series' own restored Vol. 1 does (project rule)", async () => {
    const vocab = (await getGuide()).find((g) => g.label === "Vocabulary")!.body;
    expect(vocab).toMatch(/M\.A\.D\. \(Metaphysical Awareness Disorder\):\*\* explained inside the series, in the restored \*Vol\. 1\*/);
    expect(vocab).toContain("exposure to verbal information that is not desired to be known");
    expect(vocab).toContain("Tell an authority figure, Hinder the Alternate's movements, Identify the threat level, Neutralize it if it is safe, Know your place");
    // The short copy elsewhere must not make up a meaning for the acronyms.
    const short = JSON.stringify(await Promise.all([getCards("premise"), getCards("theme"), getCards("mixup"), getCharacters()]));
    expect(short).not.toMatch(/Metaphysical/i);
  });

  it("marks inferred dates of death as inferred", async () => {
    for (const c of await getCharacters()) {
      if (/^Dies in 1992/.test(c.status)) expect(c.status, c.name).toMatch(/inferred/);
    }
  });
});
