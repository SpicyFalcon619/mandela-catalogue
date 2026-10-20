import { THREADS } from "./threads";

export type FieldType = "text" | "textarea" | "number" | "bool" | "select" | "tags" | "lines" | "tapes";
export type Field = {
  name: string; // also the SQL column
  label: string;
  type: FieldType;
  options?: [string, string][];
  required?: boolean;
  help?: string;
  /** Added to the number when reading from the form (for "1-based in the form, 0-based in the database"). */
  offset?: number;
  nullable?: boolean;
  placeholder?: string;
};
export type Entity = {
  key: string;
  table: string;
  label: string;
  singular: string;
  intro: string;
  fields: Field[];
  /** Field names shown as columns in the list. */
  columns: string[];
  orderBy: string;
};

const sort: Field = { name: "sort", label: "Order (lower first)", type: "number" };
const published: Field = { name: "published", label: "Visible on the site", type: "bool" };

export const ENTITIES: Entity[] = [
  {
    key: "tapes", table: "tapes", label: "Tapes", singular: "tape",
    intro: "Every video. Tape numbers follow release date automatically. Add new videos here when Alex Kister posts them.",
    orderBy: "release_date, id",
    columns: ["title", "release_date", "runtime", "is_main", "published"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "release_date", label: "Release date (YYYY-MM-DD)", type: "text", required: true, placeholder: "2026-03-13" },
      { name: "runtime", label: "Runtime (m:ss)", type: "text", required: true, placeholder: "26:33" },
      { name: "is_main", label: "Main volume (not a short)", type: "bool" },
      { name: "inworld_label", label: "When it happens in the story", type: "text", placeholder: "2009" },
      { name: "inworld_sort", label: "Story order number (blank = undated)", type: "number", nullable: true, help: "Used by the In-story sort. 1992.3 sorts before 2009.1." },
      { name: "confidence", label: "How sure is the story date?", type: "select", options: [["stated", "Stated by the source"], ["inferred", "Inferred"], ["unknown", "Unknown"]], required: true },
      { name: "threads", label: "Story threads", type: "tags", options: THREADS },
      { name: "summary", label: "Summary (spoilers go here)", type: "textarea" },
      { name: "note", label: "Note", type: "textarea" },
      published,
    ],
  },
  {
    key: "characters", table: "characters", label: "Case files", singular: "character",
    intro: "The people on the tapes. The tick-boxes pick which tapes each person appears in.",
    orderBy: "sort, id",
    columns: ["name", "actor", "status", "sort", "published"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "actor", label: "Voice actor credit", type: "text" },
      { name: "bio", label: "Description", type: "textarea" },
      { name: "status", label: "Status line", type: "text" },
      { name: "status_hidden", label: "Hide the status behind a spoiler bar", type: "bool" },
      { name: "tape_ids", label: "Appears in", type: "tapes" },
      sort, published,
    ],
  },
  {
    key: "quiz", table: "quiz", label: "Quiz", singular: "question",
    intro: "Multiple-choice questions shown in the quiz section.",
    orderBy: "sort, id",
    columns: ["question", "answer", "sort", "published"],
    fields: [
      { name: "question", label: "Question", type: "text", required: true },
      { name: "options", label: "Answer options (one per line, at least 2)", type: "lines", required: true },
      { name: "answer", label: "Number of the correct option (1 = first line)", type: "number", offset: -1, required: true },
      { name: "note", label: "Explanation shown after answering", type: "textarea" },
      sort, published,
    ],
  },
  {
    key: "sources", table: "sources", label: "Sources", singular: "source",
    intro: "Links shown in the Sources section. Use links to the originals, not copies of the artwork.",
    orderBy: "sort, id",
    columns: ["title", "url", "sort", "published"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "url", label: "URL (https://...)", type: "text", required: true },
      { name: "note", label: "What it is", type: "textarea" },
      sort, published,
    ],
  },
  {
    key: "guide", table: "guide", label: "Field guide", singular: "tab",
    intro: "Tabs in the field guide. Text supports **bold**, *italic*, [links](https://example.com) and lists (lines starting with - ).",
    orderBy: "sort, id",
    columns: ["label", "widget", "sort", "published"],
    fields: [
      { name: "label", label: "Tab name", type: "text", required: true },
      { name: "body", label: "Text", type: "textarea" },
      { name: "aside_title", label: "Side box title", type: "text" },
      { name: "aside_body", label: "Side box text", type: "textarea" },
      { name: "widget", label: "Side box picture", type: "select", options: [["none", "None"], ["population", "County population chart"]], required: true },
      sort, published,
    ],
  },
  {
    key: "cards", table: "cards", label: "Cards", singular: "card",
    intro: "Small text cards: premise boxes, readings, mix-ups, reception notes and film timeline entries.",
    orderBy: "kind, sort, id",
    columns: ["kind", "title", "sort", "published"],
    fields: [
      { name: "kind", label: "Where it appears", type: "select", required: true, options: [["premise", "Premise boxes"], ["theme", "Readings (themes)"], ["mixup", "Common mix-ups (title = wrong claim, text = the correction)"], ["reception", "Praise, criticism, origin"], ["film", "Film timeline (title = date)"]] },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Text", type: "textarea" },
      sort, published,
    ],
  },
];

export const entityByKey = (k: string) => ENTITIES.find((e) => e.key === k);
