import { sql, type Arg } from "./db";
import type { Settings } from "./content";

export type Hit = { title: string; href: string; snippet: string; note?: string };
export type Group = { id: string; label: string; hits: Hit[] };

export const MIN_QUERY = 2;
export const MAX_QUERY = 80;

/** Escapes LIKE wildcards so a search for "100%" or "a_b" matches those characters literally. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
const LIKE = "LIKE ? ESCAPE '\\'";

/** The part of the text around the first match, about `width` characters wide, with markup characters removed. */
export function snippet(fields: (string | null | undefined)[], q: string, width = 160): string {
  const needle = q.toLowerCase();
  const clean = (t: string) => t.replace(/\*\*|\*|\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
  const texts = fields.filter((f): f is string => !!f).map(clean);
  const text = texts.find((t) => t.toLowerCase().includes(needle)) ?? texts[0] ?? "";
  const at = text.toLowerCase().indexOf(needle);
  if (at < 0 || text.length <= width) return text.length > width ? `${text.slice(0, width)}…` : text;
  const start = Math.max(0, at - Math.floor((width - needle.length) / 2));
  const end = Math.min(text.length, start + width);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

const lim = 12;

/** Searches the public content and the visible discussion. Sections an admin has switched off are not searched. */
export async function searchSite(q: string, s: Settings): Promise<Group[]> {
  const like = likePattern(q);
  const n = (k: number): Arg[] => Array(k).fill(like);
  const on = (key: string) => s[key] === "1";
  const groups: Promise<Group>[] = [];

  groups.push(
    sql
      .all<{ id: number; title: string; summary: string; note: string; detail: string }>(
        `SELECT id, title, summary, note, detail FROM tapes WHERE published = 1 AND (title ${LIKE} OR summary ${LIKE} OR note ${LIKE} OR detail ${LIKE}) ORDER BY release_date, id LIMIT ${lim}`,
        ...n(4),
      )
      .then((rows) => ({
        id: "tapes",
        label: "Tapes",
        hits: rows.map((r) => ({ title: r.title, href: `/tapes/${r.id}`, snippet: snippet([r.title, r.summary, r.note, r.detail], q) })),
      })),
  );
  if (on("show_theories")) {
    groups.push(
      sql
        .all<{ id: number; title: string; claim: string; body: string; support: string; against: string }>(
          `SELECT id, title, claim, body, support, against FROM theories WHERE published = 1 AND (title ${LIKE} OR claim ${LIKE} OR body ${LIKE} OR support ${LIKE} OR against ${LIKE}) ORDER BY sort, id LIMIT ${lim}`,
          ...n(5),
        )
        .then((rows) => ({
          id: "theories",
          label: "Fan theories (unconfirmed)",
          hits: rows.map((r) => ({ title: r.title, href: `/theories/${r.id}`, snippet: snippet([r.title, r.claim, r.body, r.support, r.against], q) })),
        })),
    );
  }
  if (on("show_files")) {
    groups.push(
      sql
        .all<{ id: number; name: string; actor: string; bio: string }>(
          `SELECT id, name, actor, bio FROM characters WHERE published = 1 AND (name ${LIKE} OR actor ${LIKE} OR bio ${LIKE}) ORDER BY sort, id LIMIT ${lim}`,
          ...n(3),
        )
        .then((rows) => ({ id: "files", label: "Case files", hits: rows.map((r) => ({ title: r.name, href: "/#files", snippet: snippet([r.bio, r.actor], q) })) })),
    );
  }
  if (on("show_guide")) {
    groups.push(
      sql
        .all<{ id: number; label: string; body: string; aside_title: string; aside_body: string }>(
          `SELECT id, label, body, aside_title, aside_body FROM guide WHERE published = 1 AND (label ${LIKE} OR body ${LIKE} OR aside_title ${LIKE} OR aside_body ${LIKE}) ORDER BY sort, id LIMIT ${lim}`,
          ...n(4),
        )
        .then((rows) => ({ id: "guide", label: "Field guide", hits: rows.map((r) => ({ title: r.label, href: "/#guide", snippet: snippet([r.body, r.aside_body], q) })) })),
    );
  }
  const cardAnchor: Record<string, [string, string]> = {
    premise: ["show_premise", "premise"],
    theme: ["show_reading", "reading"],
    mixup: ["show_reading", "reading"],
    reception: ["show_outside", "outside"],
    film: ["show_outside", "outside"],
  };
  groups.push(
    sql
      .all<{ id: number; kind: string; title: string; body: string }>(
        `SELECT id, kind, title, body FROM cards WHERE published = 1 AND (title ${LIKE} OR body ${LIKE}) ORDER BY sort, id LIMIT 30`,
        ...n(2),
      )
      .then((rows) => ({
        id: "cards",
        label: "Notes and readings",
        hits: rows
          .filter((r) => cardAnchor[r.kind] && on(cardAnchor[r.kind][0]))
          .slice(0, lim)
          .map((r) => ({ title: r.title, href: `/#${cardAnchor[r.kind][1]}`, snippet: snippet([r.body], q) })),
      })),
  );
  if (on("show_sources")) {
    groups.push(
      sql
        .all<{ id: number; title: string; url: string; note: string }>(
          `SELECT id, title, url, note FROM sources WHERE published = 1 AND (title ${LIKE} OR note ${LIKE}) ORDER BY sort, id LIMIT ${lim}`,
          ...n(2),
        )
        .then((rows) => ({ id: "sources", label: "Sources", hits: rows.map((r) => ({ title: r.title, href: "/#sources", snippet: snippet([r.note], q) })) })),
    );
  }
  groups.push(
    sql
      .all<{ id: number; tape_id: number; body: string; spoiler: number; username: string | null; tape_title: string }>(
        `SELECT c.id, c.tape_id, c.body, c.spoiler, u.username, t.title AS tape_title
         FROM comments c JOIN tapes t ON t.id = c.tape_id AND t.published = 1 LEFT JOIN users u ON u.id = c.user_id
         WHERE c.status = 'visible' AND c.deleted = 0 AND (c.body ${LIKE} OR u.username ${LIKE})
         ORDER BY c.created_at DESC, c.id DESC LIMIT ${lim}`,
        ...n(2),
      )
      .then((rows) => ({
        id: "comments",
        label: "Discussion",
        hits: rows.map((r) => ({
          title: `${r.username ?? "[deleted]"} on ${r.tape_title}`,
          href: `/tapes/${r.tape_id}#c${r.id}`,
          snippet: r.spoiler ? "This comment is marked as containing spoilers. Open it to read." : snippet([r.body], q),
        })),
      })),
  );

  return (await Promise.all(groups)).filter((g) => g.hits.length > 0);
}
