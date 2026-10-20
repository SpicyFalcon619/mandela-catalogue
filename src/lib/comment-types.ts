/**
 * Shared, browser-safe pieces of the discussion system: the shape of a comment, ranking, threading and
 * time formatting. Nothing here touches the database, so client components and tests can import it freely.
 */

export type CommentKind = "comment" | "theory" | "correction";
export type CommentStatus = "visible" | "pending" | "hidden";
export type SortMode = "best" | "top" | "new" | "old";
export type KindFilter = "all" | CommentKind;

export type CommentDTO = {
  id: number;
  parentId: number | null;
  depth: number;
  kind: CommentKind;
  body: string;
  status: CommentStatus;
  /** UTC, "YYYY-MM-DD HH:MM:SS" as SQLite writes it. */
  createdAt: string;
  editedAt: string | null;
  /** Removed by its author or a moderator but kept as a placeholder because it has replies. */
  deleted: boolean;
  pinned: boolean;
  spoiler: boolean;
  userId: number;
  username: string;
  role: "user" | "admin";
  ups: number;
  downs: number;
  /** The signed-in viewer's own vote: 1, -1 or 0. */
  myVote: -1 | 0 | 1;
};

export const MAX_BODY = 1500;
export const MIN_BODY = 3;
/** Replies nest this many levels below a top-level comment; deeper replies attach to the level above. */
export const MAX_DEPTH = 3;
/** A comment is hidden for review once this many different people report it. */
export const REPORT_HIDE_THRESHOLD = 3;

export const REPORT_REASONS = [
  ["spam", "Spam"],
  ["abuse", "Abuse or harassment"],
  ["spoiler", "Unmarked spoiler"],
  ["offtopic", "Off topic"],
  ["other", "Something else"],
] as const;
export const REPORT_REASON_IDS: readonly string[] = REPORT_REASONS.map((r) => r[0]);

export const KIND_LABEL: Record<CommentKind, string> = { comment: "Comment", theory: "Fan theory", correction: "Correction" };

export const score = (c: Pick<CommentDTO, "ups" | "downs">) => c.ups - c.downs;

/**
 * Lower bound of the Wilson score interval (80% confidence) for the share of upvotes. It ranks "best" fairly:
 * a comment with 1 up and 0 down does not beat one with 40 up and 5 down. Zero votes score 0.
 */
export function wilson(ups: number, downs: number): number {
  const n = ups + downs;
  if (n === 0) return 0;
  const z = 1.2815515655446004;
  const p = ups / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / (1 + (z * z) / n);
}

/** SQLite's "YYYY-MM-DD HH:MM:SS" (UTC) to a Date. */
export function parseUtc(s: string): Date {
  return new Date(s.replace(" ", "T") + "Z");
}

export function timeAgo(from: Date, now: Date = new Date()): string {
  const sec = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (sec < 45) return "just now";
  const units: [number, string][] = [[60, "min"], [3600, "h"], [86400, "d"], [604800, "w"], [2629800, "mo"], [31557600, "y"]];
  let label = "min";
  let value = Math.max(1, Math.round(sec / 60));
  for (const [size, name] of units) {
    if (sec >= size) {
      label = name;
      value = Math.floor(sec / size);
    }
  }
  return `${value} ${label} ago`;
}

export type CommentNode = CommentDTO & { children: CommentNode[] };

type SortFn = (a: CommentDTO, b: CommentDTO) => number;
const byNewest: SortFn = (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id);
const byOldest: SortFn = (a, b) => -byNewest(a, b);

export function sorter(mode: SortMode): SortFn {
  switch (mode) {
    case "new":
      return byNewest;
    case "old":
      return byOldest;
    case "top":
      return (a, b) => score(b) - score(a) || byNewest(a, b);
    default:
      return (a, b) => wilson(b.ups, b.downs) - wilson(a.ups, a.downs) || score(b) - score(a) || byNewest(a, b);
  }
}

export type TreeOptions = { sort: SortMode; kind?: KindFilter; query?: string };

/**
 * Builds the visible thread. Replies whose parent is not in the list (hidden or removed) become top-level.
 * Removed placeholders with no remaining replies are dropped. With a search query, only matching comments and
 * the comments above them (for context) are kept. The kind filter applies to top-level comments only.
 */
export function buildTree(list: CommentDTO[], opts: TreeOptions): { roots: CommentNode[]; matches: Set<number> } {
  const byId = new Map<number, CommentNode>();
  for (const c of list) byId.set(c.id, { ...c, children: [] });
  const roots: CommentNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId !== null ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const q = (opts.query ?? "").trim().toLowerCase();
  const matches = new Set<number>();
  const hit = (c: CommentDTO) => !c.deleted && (c.body.toLowerCase().includes(q) || c.username.toLowerCase().includes(q));

  const order = sorter(opts.sort);
  const prune = (nodes: CommentNode[]): CommentNode[] => {
    const kept: CommentNode[] = [];
    for (const n of nodes) {
      n.children = prune(n.children).sort(order);
      const selfHit = q !== "" && hit(n);
      if (selfHit) matches.add(n.id);
      const alive = !n.deleted || n.children.length > 0;
      if (!alive) continue;
      if (q !== "" && !selfHit && n.children.length === 0) continue;
      kept.push(n);
    }
    return kept;
  };

  let top = prune(roots);
  if (opts.kind && opts.kind !== "all") top = top.filter((n) => n.kind === opts.kind);
  top.sort((a, b) => Number(b.pinned) - Number(a.pinned) || order(a, b));
  return { roots: top, matches };
}

/** Number of comments (replies included) that the viewer can see, not counting removed placeholders. */
export function countComments(list: CommentDTO[]): number {
  return list.filter((c) => !c.deleted && c.status === "visible").length;
}

/** Applies a new vote to a comment's counts, as the server will: returns the updated copy. */
export function withVote<T extends Pick<CommentDTO, "ups" | "downs" | "myVote">>(c: T, value: -1 | 0 | 1): T {
  let { ups, downs } = c;
  if (c.myVote === 1) ups -= 1;
  if (c.myVote === -1) downs -= 1;
  if (value === 1) ups += 1;
  if (value === -1) downs += 1;
  return { ...c, ups, downs, myVote: value };
}
