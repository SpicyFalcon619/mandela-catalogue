import { db } from "./db";
import { DEFAULT_SETTINGS } from "./defaults";

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

export function getSettings(): Settings {
  const rows = db().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

type TapeRow = {
  id: number; title: string; release_date: string; runtime: string; is_main: number; inworld_label: string;
  inworld_sort: number | null; confidence: string; threads: string; summary: string; note: string; published: number;
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
  };
}

/** Published tapes in release order; `number` is the position in that order. */
export function getTapes(): Tape[] {
  const rows = db().prepare("SELECT * FROM tapes WHERE published = 1 ORDER BY release_date, id").all() as TapeRow[];
  return rows.map((r, i) => mapTape(r, i + 1));
}
export function getTape(id: number): Tape | null {
  return getTapes().find((t) => t.id === id) ?? null;
}

export function getCharacters(): Character[] {
  const rows = db().prepare("SELECT * FROM characters WHERE published = 1 ORDER BY sort, id").all() as {
    id: number; name: string; actor: string; bio: string; status: string; status_hidden: number; tape_ids: string;
  }[];
  return rows.map((r) => ({
    id: r.id, name: r.name, actor: r.actor, bio: r.bio, status: r.status,
    statusHidden: !!r.status_hidden, tapeIds: parseJson<number[]>(r.tape_ids, []),
  }));
}
export function getQuiz(): QuizQ[] {
  const rows = db().prepare("SELECT * FROM quiz WHERE published = 1 ORDER BY sort, id").all() as {
    id: number; question: string; options: string; answer: number; note: string;
  }[];
  return rows.map((r) => ({ id: r.id, question: r.question, options: parseJson<string[]>(r.options, []), answer: r.answer, note: r.note }));
}
export function getSources(): Source[] {
  return db().prepare("SELECT id, title, url, note FROM sources WHERE published = 1 ORDER BY sort, id").all() as Source[];
}
export function getGuide(): GuideTab[] {
  const rows = db().prepare("SELECT * FROM guide WHERE published = 1 ORDER BY sort, id").all() as {
    id: number; label: string; body: string; aside_title: string; aside_body: string; widget: string;
  }[];
  return rows.map((r) => ({ id: r.id, label: r.label, body: r.body, asideTitle: r.aside_title, asideBody: r.aside_body, widget: r.widget }));
}
export function getCards(kind: string): Card[] {
  return db().prepare("SELECT id, kind, title, body FROM cards WHERE kind = ? AND published = 1 ORDER BY sort, id").all(kind) as Card[];
}
