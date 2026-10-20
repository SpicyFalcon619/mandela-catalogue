import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getSettings, getTapes, getTheories, getTheory } from "@/lib/content";
import { ENTITIES } from "@/lib/entities";
import { Rich } from "@/lib/rich";
import { searchSite } from "@/lib/search";

describe("tape explanations", () => {
  it("every seeded tape has a long, structured explanation with sources", async () => {
    const tapes = await getTapes();
    expect(tapes).toHaveLength(19);
    for (const t of tapes) {
      expect(t.hasDetail, t.title).toBe(true);
      expect(t.detail.length, t.title).toBeGreaterThan(1500);
      for (const h of ["## In short", "## What happens", "## Who and what appears", "## Where it fits", "## What it settles", "## What it leaves open", "## Common questions", "## Credits and sources"]) {
        expect(t.detail, `${t.title}: ${h}`).toContain(h);
      }
      expect(t.detail, t.title).toContain("mandela-catalogue.fandom.com/wiki/");
    }
  });

  it("uses no emoji and no template leftovers", async () => {
    for (const t of await getTapes()) {
      expect(t.detail, t.title).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t.detail, t.title).not.toContain("${");
    }
  });
});

describe("premade theories", () => {
  it("are complete and point at real tapes", async () => {
    const theories = await getTheories();
    const ids = new Set((await getTapes()).map((t) => t.id));
    expect(theories.length).toBeGreaterThanOrEqual(10);
    for (const t of theories) {
      expect(t.claim, t.title).not.toBe("");
      expect(t.support, t.title).toMatch(/^- /);
      expect(t.against, t.title).toMatch(/^- /);
      expect(t.source, t.title).toContain("mandela-catalogue.fandom.com");
      expect(t.tapeIds.length, t.title).toBeGreaterThan(0);
      for (const id of t.tapeIds) expect(ids.has(id), `${t.title}: tape ${id}`).toBe(true);
    }
  });

  it("can be read one by one, and an unknown id gives nothing", async () => {
    const first = (await getTheories())[0];
    expect((await getTheory(first.id))!.title).toBe(first.title);
    expect(await getTheory(999999)).toBeNull();
  });

  it("are found by site search, and left out when the section is switched off", async () => {
    const s = await getSettings();
    expect((await searchSite("Sleeper", s)).find((g) => g.id === "theories")?.hits.length).toBeGreaterThan(0);
    expect((await searchSite("Sleeper", { ...s, show_theories: "0" })).find((g) => g.id === "theories")).toBeUndefined();
  });

  it("long explanations are searchable too", async () => {
    const groups = await searchSite("Stanley", await getSettings());
    expect(groups.find((g) => g.id === "tapes")!.hits.some((h) => /Vol\. 333/.test(h.title))).toBe(true);
  });

  it("can be edited in the admin like the other content", () => {
    const e = ENTITIES.find((x) => x.key === "theories")!;
    expect(e.table).toBe("theories");
    expect(e.fields.map((f) => f.name)).toEqual(expect.arrayContaining(["title", "standing", "claim", "body", "support", "against", "source", "tape_ids"]));
    expect(ENTITIES.find((x) => x.key === "tapes")!.fields.map((f) => f.name)).toContain("detail");
  });
});

describe("rich text headings and numbered lists", () => {
  it("renders a heading above its text, numbered steps and bullets", () => {
    const html = renderToStaticMarkup(createElement(Rich, { text: "## First part\n\nSome **bold** text.\n\n## Steps\n1. One\n2. Two\n\n- a\n- b" }));
    expect(html).toContain('<h3 class="rh">First part</h3>');
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<ol><li>One</li><li>Two</li></ol>");
    expect(html).toContain("<ul><li>a</li><li>b</li></ul>");
  });

  it("still escapes markup", () => {
    expect(renderToStaticMarkup(createElement(Rich, { text: "## <script>x</script>\n\n<img src=x onerror=1>" }))).not.toContain("<script>");
  });
});
