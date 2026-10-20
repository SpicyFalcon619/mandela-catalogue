import { describe, expect, it } from "vitest";
import { buildTree, countComments, parseUtc, score, sorter, timeAgo, wilson, withVote, type CommentDTO } from "@/lib/comment-types";

let n = 0;
function c(over: Partial<CommentDTO> = {}): CommentDTO {
  n += 1;
  return {
    id: n, parentId: null, depth: 0, kind: "comment", body: `body ${n}`, status: "visible",
    createdAt: `2026-01-01 00:00:${String(n % 60).padStart(2, "0")}`, editedAt: null, deleted: false, pinned: false, spoiler: false,
    userId: 7, username: "reader", role: "user", ups: 0, downs: 0, myVote: 0, ...over,
  };
}

describe("wilson score", () => {
  it("ranks a well-supported comment above a lucky single vote", () => {
    expect(wilson(40, 5)).toBeGreaterThan(wilson(1, 0));
    expect(wilson(100, 30)).toBeGreaterThan(wilson(3, 0));
  });
  it("is 0 with no votes and grows with agreement", () => {
    expect(wilson(0, 0)).toBe(0);
    expect(wilson(10, 0)).toBeGreaterThan(wilson(10, 10));
    expect(wilson(0, 10)).toBeLessThan(wilson(5, 5));
  });
  it("stays within 0..1", () => {
    for (const [u, d] of [[0, 1], [1, 0], [1000, 1], [3, 97]]) {
      const w = wilson(u, d);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });
});

describe("sorting", () => {
  const old = c({ createdAt: "2026-01-01 10:00:00", ups: 2 });
  const mid = c({ createdAt: "2026-01-02 10:00:00", ups: 9, downs: 8 });
  const fresh = c({ createdAt: "2026-01-03 10:00:00", ups: 0 });
  const ids = (m: Parameters<typeof sorter>[0]) => [old, mid, fresh].sort(sorter(m)).map((x) => x.id);
  it("new and old are by time", () => {
    expect(ids("new")).toEqual([fresh.id, mid.id, old.id]);
    expect(ids("old")).toEqual([old.id, mid.id, fresh.id]);
  });
  it("top is by net score, ties newest first", () => {
    expect(score(mid)).toBe(1);
    expect(ids("top")).toEqual([old.id, mid.id, fresh.id]);
  });
  it("best prefers agreement over raw size", () => {
    expect(ids("best")[0]).toBe(old.id); // 2-0 beats 9-8
    expect(ids("best")[2]).toBe(fresh.id);
  });
});

describe("buildTree", () => {
  it("nests replies under their parents and sorts siblings", () => {
    const root = c();
    const a = c({ parentId: root.id, depth: 1, ups: 5, createdAt: "2026-01-01 01:00:00" });
    const b = c({ parentId: root.id, depth: 1, ups: 1, createdAt: "2026-01-01 02:00:00" });
    const deep = c({ parentId: a.id, depth: 2 });
    const { roots } = buildTree([deep, b, a, root], { sort: "top" });
    expect(roots).toHaveLength(1);
    expect(roots[0].children.map((x) => x.id)).toEqual([a.id, b.id]);
    expect(roots[0].children[0].children.map((x) => x.id)).toEqual([deep.id]);
  });

  it("promotes a reply whose parent is gone (hidden or removed) to the top level", () => {
    const orphan = c({ parentId: 999999, depth: 1 });
    expect(buildTree([orphan], { sort: "new" }).roots.map((x) => x.id)).toEqual([orphan.id]);
  });

  it("drops removed placeholders with no replies, keeps those that still have some", () => {
    const lone = c({ deleted: true, body: "", username: "[deleted]" });
    const parent = c({ deleted: true, body: "", username: "[deleted]" });
    const kid = c({ parentId: parent.id, depth: 1 });
    const { roots } = buildTree([lone, parent, kid], { sort: "new" });
    expect(roots.map((x) => x.id)).toEqual([parent.id]);
    expect(roots[0].children.map((x) => x.id)).toEqual([kid.id]);
  });

  it("puts the pinned comment first whatever the sort", () => {
    const top = c({ ups: 50 });
    const pinned = c({ pinned: true, ups: 0, createdAt: "2020-01-01 00:00:00" });
    for (const sort of ["best", "top", "new", "old"] as const) {
      expect(buildTree([top, pinned], { sort }).roots[0].id).toBe(pinned.id);
    }
  });

  it("filters top-level comments by kind but keeps their replies", () => {
    const comment = c();
    const theory = c({ kind: "theory" });
    const reply = c({ parentId: theory.id, depth: 1 });
    const { roots } = buildTree([comment, theory, reply], { sort: "new", kind: "theory" });
    expect(roots.map((x) => x.id)).toEqual([theory.id]);
    expect(roots[0].children).toHaveLength(1);
  });

  describe("search", () => {
    const root = c({ body: "Plain opening" });
    const reply = c({ parentId: root.id, depth: 1, body: "Gabriel is Satan, I think" });
    const other = c({ body: "Unrelated thing", username: "gabriela" });
    const miss = c({ body: "Nothing here" });
    it("keeps matches and the comments above them for context, and drops the rest", () => {
      const { roots, matches } = buildTree([root, reply, other, miss], { sort: "old", query: "gabriel" });
      expect(roots.map((x) => x.id).sort()).toEqual([root.id, other.id].sort()); // root only as context; other by username
      expect([...matches].sort()).toEqual([reply.id, other.id].sort());
      expect(roots.find((x) => x.id === root.id)!.children.map((x) => x.id)).toEqual([reply.id]);
    });
    it("is case-insensitive and ignores surrounding spaces", () => {
      expect(buildTree([reply], { sort: "new", query: "  SATAN " }).matches.has(reply.id)).toBe(true);
    });
    it("does not search the text of removed comments", () => {
      const gone = c({ deleted: true, body: "" });
      expect(buildTree([gone], { sort: "new", query: "x" }).roots).toHaveLength(0);
    });
  });
});

describe("withVote", () => {
  const base = { ups: 3, downs: 1, myVote: 0 as -1 | 0 | 1 };
  it("adds, switches and removes a vote the way the server does", () => {
    const up = withVote(base, 1);
    expect(up).toEqual({ ups: 4, downs: 1, myVote: 1 });
    expect(withVote(up, -1)).toEqual({ ups: 3, downs: 2, myVote: -1 });
    expect(withVote(withVote(up, -1), 0)).toEqual({ ups: 3, downs: 1, myVote: 0 });
    expect(withVote(up, 0)).toEqual(base);
  });
});

describe("countComments", () => {
  it("counts visible, non-removed comments including replies", () => {
    expect(countComments([c(), c({ deleted: true }), c({ status: "pending" }), c({ parentId: 1, depth: 1 })])).toBe(2);
  });
});

describe("time", () => {
  const t = parseUtc("2026-03-01 12:00:00");
  const at = (s: number) => timeAgo(t, new Date(t.getTime() + s * 1000));
  it("parses SQLite timestamps as UTC", () => expect(t.toISOString()).toBe("2026-03-01T12:00:00.000Z"));
  it("says how long ago in the largest sensible unit", () => {
    expect(at(10)).toBe("just now");
    expect(at(90)).toBe("1 min ago");
    expect(at(150)).toBe("2 min ago");
    expect(at(3 * 3600)).toBe("3 h ago");
    expect(at(2 * 86400)).toBe("2 d ago");
    expect(at(21 * 86400)).toBe("3 w ago");
    expect(at(400 * 86400)).toBe("1 y ago");
  });
  it("never shows a negative age", () => expect(timeAgo(new Date(2030, 0, 1), new Date(2026, 0, 1))).toBe("just now"));
});
