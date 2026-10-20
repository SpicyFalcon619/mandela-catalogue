import { cache } from "react";
import { sql } from "./db";
import { DEFAULT_SETTINGS } from "./defaults";
import { youtubeHref, youtubeId } from "./youtube";

export type Confidence = "stated" | "inferred" | "unknown";

export type Tape = {
  id: number;
  number: number;
  title: string;
  releaseDate: string;
  runtime: string;
  seconds: number;
  isMain: boolean;
  inworldLabel: string;
  inworldSort: number | null;
  confidence: Confidence;
  threads: string[];
  summary: string;
  note: string;
  /** Validated https YouTube link, or empty. */
  youtubeUrl: string;
  /** The 11-character id of that video, or empty. Used for the click-to-play embed. */
  youtubeId: string;
  /** Channel credited under the video (empty means Alex Kister's main channel). */
  youtubeChannel: string;
};
export type Character = { id: number; name: string; actor: string; bio: string; status: string; statusHidden: boolean; tapeIds: number[] };
export type QuizQ = { id: number; question: string; options: string[]; answer: number; note: string };
export type Source = { id: number; title: string; url: string; note: string };
export type GuideTab = { id: number; label: string; body: string; asideTitle: string; asideBody: string; widget: string };
export type Card = { id: number; kind: string; title: string; body: string };
export type Settings = Record<string, string>;

export { THREADS } from "./threads";

function secs(m: string) {
  const [a, b] = m.split(":").map((n) => parseInt(n, 10) || 0);
  return a * 60 + b;
}
function parseJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// `cache` makes these run once per request even when the layout and the page both ask.
export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await sql.all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
});

type TapeRow = {
  id: number; title: string; release_date: string; runtime: string; is_main: number; inworld_label: string;
  inworld_sort: number | null; confidence: string; threads: string; summary: string; note: string; youtube_url: string; youtube_channel: string; published: number;
};
function mapTape(r: TapeRow, number: number): Tape {
  return {
    id: r.id,
    number,
    title: r.title,
    releaseDate: r.release_date,
    runtime: r.runtime,
    seconds: secs(r.runtime),
    isMain: !!r.is_main,
    inworldLabel: r.inworld_label,
    inworldSort: r.inworld_sort,
    confidence: (["stated", "inferred", "unknown"].includes(r.confidence) ? r.confidence : "unknown") as Confidence,
    threads: parseJson<string[]>(r.threads, []),
    summary: r.summary,
    note: r.note,
    youtubeUrl: youtubeHref(r.youtube_url),
    youtubeId: youtubeId(r.youtube_url),
    youtubeChannel: (r.youtube_channel ?? "").trim(),
  };
}

/** Published tapes in release order; `number` is the position in that order. */
export const getTapes = cache(async (): Promise<Tape[]> => {
  const rows = await sql.all<TapeRow>("SELECT * FROM tapes WHERE published = 1 ORDER BY release_date, id");
  return rows.map((r, i) => mapTape(r, i + 1));
});
export async function getTape(id: number): Promise<Tape | null> {
  return (await getTapes()).find((t) => t.id === id) ?? null;
}

export async function getCharacters(): Promise<Character[]> {
  const rows = await sql.all<{
    id: number; name: string; actor: string; bio: string; status: string; status_hidden: number; tape_ids: string;
  }>("SELECT * FROM characters WHERE published = 1 ORDER BY sort, id");
  return rows.map((r) => ({
    id: r.id, name: r.name, actor: r.actor, bio: r.bio, status: r.status,
    statusHidden: !!r.status_hidden, tapeIds: parseJson<number[]>(r.tape_ids, []),
  }));
}
export async function getQuiz(): Promise<QuizQ[]> {
  const rows = await sql.all<{
    id: number; question: string; options: string; answer: number; note: string;
  }>("SELECT * FROM quiz WHERE published = 1 ORDER BY sort, id");
  return rows.map((r) => ({ id: r.id, question: r.question, options: parseJson<string[]>(r.options, []), answer: r.answer, note: r.note }));
}
export async function getSources(): Promise<Source[]> {
  return sql.all<Source>("SELECT id, title, url, note FROM sources WHERE published = 1 ORDER BY sort, id");
}
export async function getGuide(): Promise<GuideTab[]> {
  const rows = await sql.all<{
    id: number; label: string; body: string; aside_title: string; aside_body: string; widget: string;
  }>("SELECT * FROM guide WHERE published = 1 ORDER BY sort, id");
  return rows.map((r) => ({ id: r.id, label: r.label, body: r.body, asideTitle: r.aside_title, asideBody: r.aside_body, widget: r.widget }));
}
export async function getCards(kind: string): Promise<Card[]> {
  return sql.all<Card>("SELECT id, kind, title, body FROM cards WHERE kind = ? AND published = 1 ORDER BY sort, id", kind);
}
