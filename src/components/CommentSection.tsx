"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteComment, editComment, postComment, reportComment, voteComment, type SaveResult } from "@/app/actions/comments";
import { pinComment } from "@/app/actions/admin";
import {
  KIND_LABEL,
  MAX_BODY,
  MIN_BODY,
  REPORT_REASONS,
  buildTree,
  countComments,
  parseUtc,
  score,
  timeAgo,
  withVote,
  type CommentDTO,
  type CommentKind,
  type CommentNode,
  type KindFilter,
  type SortMode,
} from "@/lib/comment-types";

type Viewer = { id: number; username: string; role: "user" | "admin" } | null;

type Props = {
  tapeId: number;
  initial: CommentDTO[];
  viewer: Viewer;
  commentsOn: boolean;
  submissionsOn: boolean;
  loginHref: string;
  registerHref: string;
};

const SORTS: [SortMode, string][] = [["best", "Best"], ["top", "Top"], ["new", "Newest"], ["old", "Oldest"]];
const TABS: [KindFilter, string][] = [["all", "All"], ["comment", "Comments"], ["theory", "Theories"], ["correction", "Corrections"]];

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true" focusable="false">
      <path d={up ? "M3 10l5-5 5 5" : "M3 6l5 5 5-5"} />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
      <path d="M3 14V2.5M3 3h8.5l-1.7 3 1.7 3H3" />
    </svg>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Composer: new post, reply, or edit. The same box for all three.

type Draft = { body: string; kind: CommentKind; spoiler: boolean };

function Composer(props: {
  mode: "post" | "reply" | "edit";
  kinds: CommentKind[];
  initial?: Partial<Draft>;
  draftKey?: string;
  autoFocus?: boolean;
  label?: string;
  submit: (d: Draft) => Promise<SaveResult>;
  onDone: (r: Extract<SaveResult, { ok: true }>) => void;
  onCancel?: () => void;
}) {
  const { mode, kinds, draftKey } = props;
  const [body, setBody] = useState(props.initial?.body ?? "");
  const [kind, setKind] = useState<CommentKind>(props.initial?.kind ?? kinds[0]);
  const [spoiler, setSpoiler] = useState(props.initial?.spoiler ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  // A half-written post survives a reload or an accidental navigation (per tape, on this browser only).
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Draft>;
        if (typeof d.body === "string") setBody(d.body);
        if (d.kind && kinds.includes(d.kind)) setKind(d.kind);
      }
    } catch {
      /* storage can be unavailable; the box still works */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey) return;
    const t = setTimeout(() => {
      try {
        if (body.trim()) localStorage.setItem(draftKey, JSON.stringify({ body, kind }));
        else localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [draftKey, body, kind]);
  useEffect(() => {
    if (props.autoFocus) area.current?.focus();
  }, [props.autoFocus]);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await props.submit({ body, kind, spoiler });
      if (r.ok) {
        if (draftKey) {
          try {
            localStorage.removeItem(draftKey);
          } catch {
            /* ignore */
          }
        }
        if (mode === "post") {
          setBody("");
          setSpoiler(false);
          setMessage(r.message);
        }
        props.onDone(r);
      } else {
        setError(r.error);
        if (r.body !== undefined) setBody(r.body);
      }
    } catch {
      setError("Could not reach the server. Your text is still here; try again.");
    } finally {
      setBusy(false);
    }
  };

  const short = body.trim().length < MIN_BODY;
  const buttonText = mode === "edit" ? "Save" : mode === "reply" ? "Reply" : "Post";
  return (
    <form
      className="form cmt-form"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      {mode === "post" && kinds.length > 1 && (
        <label>
          Post type
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as CommentKind)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k === "comment" ? "Comment (shows right away)" : k === "theory" ? "Fan theory (reviewed first)" : "Correction to this page (reviewed first)"}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {props.label ?? "Your post"}
        <textarea
          ref={area}
          name="body"
          value={body}
          maxLength={MAX_BODY}
          rows={mode === "post" ? 4 : 3}
          placeholder={mode === "post" ? "Keep it about the tape. Tick the spoiler box if you give away plot." : ""}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
            // Enter posts; Shift+Enter starts a new line. On a phone the Enter key stays a new line (use the button).
            if (e.ctrlKey || e.metaKey || (!e.shiftKey && !touch)) {
              e.preventDefault();
              if (!short) void send();
            }
          }}
        />
      </label>
      <div className="cmt-formbar">
        <label className="choice">
          <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} /> Contains spoilers
        </label>
        <span className={`cmt-count${body.length > MAX_BODY - 100 ? " warn" : ""}`} aria-hidden="true">
          {body.length}/{MAX_BODY}
        </span>
        <span className="cmt-spacer" />
        {props.onCancel && (
          <button type="button" className="btn sm" onClick={props.onCancel} disabled={busy}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn fill sm" disabled={busy || short}>
          {busy ? "Working…" : buttonText}
        </button>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {message && <p className="okmsg" role="status">{message}</p>}
      {mode === "post" && <p className="cmt-hint">Press Enter to post, Shift+Enter for a new line. Plain text only.</p>}
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------------

export function CommentSection({ tapeId, initial, viewer, commentsOn, submissionsOn, loginHref, registerHref }: Props) {
  const [comments, setComments] = useState<CommentDTO[]>(initial);
  const [sort, setSort] = useState<SortMode>("best");
  const [kindTab, setKindTab] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [reporting, setReporting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [busyVote, setBusyVote] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [target, setTarget] = useState<number | null>(null);

  const kinds: CommentKind[] = useMemo(() => {
    const k: CommentKind[] = [];
    if (commentsOn) k.push("comment");
    if (submissionsOn) k.push("theory", "correction");
    return k;
  }, [commentsOn, submissionsOn]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Relative times are filled in after load so the server and browser renders agree.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const say = useCallback((m: string) => {
    setNotice("");
    setTimeout(() => setNotice(m), 30); // re-announce even if the text is the same as before
  }, []);

  // Permalinks (#c123): scroll to the comment and flash it.
  useEffect(() => {
    const go = () => {
      const m = /^#c(\d+)$/.exec(window.location.hash);
      if (!m) return;
      const id = Number(m[1]);
      setTarget(id);
      setTimeout(() => document.getElementById(`c${id}`)?.scrollIntoView({ block: "center" }), 60);
      setTimeout(() => setTarget((t) => (t === id ? null : t)), 3000);
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);

  const { roots, matches } = useMemo(() => buildTree(comments, { sort, kind: kindTab, query }), [comments, sort, kindTab, query]);
  const total = countComments(comments);
  // Each tab counts every visible post in its threads, replies included, so "All" matches the number in the heading.
  const tabCounts = useMemo(() => {
    const byId = new Map(comments.map((x) => [x.id, x]));
    const threadKind = (x: CommentDTO): CommentKind => {
      let top = x;
      for (let i = 0; i < 10 && top.parentId !== null; i++) {
        const up = byId.get(top.parentId);
        if (!up) break;
        top = up;
      }
      return top.kind;
    };
    const c: Record<KindFilter, number> = { all: 0, comment: 0, theory: 0, correction: 0 };
    for (const x of comments) {
      if (x.deleted || x.status !== "visible") continue;
      c[threadKind(x)] += 1;
      c.all += 1;
    }
    return c;
  }, [comments]);

  const upsert = (c: CommentDTO) => setComments((cs) => (cs.some((x) => x.id === c.id) ? cs.map((x) => (x.id === c.id ? c : x)) : [...cs, c]));

  const toggleCollapsed = (id: number) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const onVote = async (c: CommentDTO, value: -1 | 1) => {
    if (busyVote.has(c.id)) return;
    const next = c.myVote === value ? 0 : value; // pressing the active arrow takes the vote back
    setBusyVote((s) => new Set(s).add(c.id));
    setComments((cs) => cs.map((x) => (x.id === c.id ? withVote(x, next) : x))); // shown at once, confirmed below
    const r = await voteComment(c.id, next);
    setBusyVote((s) => {
      const n = new Set(s);
      n.delete(c.id);
      return n;
    });
    if (r.ok) setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, ups: r.ups, downs: r.downs, myVote: r.myVote } : x)));
    else {
      setComments((cs) => cs.map((x) => (x.id === c.id ? c : x)));
      say(r.error);
    }
  };

  const onDelete = async (c: CommentDTO) => {
    setConfirmDelete(null);
    const r = await deleteComment(c.id);
    if (!r.ok) return say(r.error);
    setComments((cs) =>
      r.removed === "soft"
        ? cs.map((x) => (x.id === c.id ? { ...x, deleted: true, body: "", username: "[deleted]", userId: 0, pinned: false, spoiler: false, ups: 0, downs: 0, myVote: 0, editedAt: null } : x))
        : cs.filter((x) => x.id !== c.id),
    );
    say("Comment removed.");
  };

  const onPin = async (c: CommentDTO) => {
    const r = await pinComment(c.id, !c.pinned);
    if (!r.ok) return say(r.error);
    setComments((cs) => cs.map((x) => ({ ...x, pinned: r.pinnedId === x.id })));
    say(c.pinned ? "Unpinned." : "Pinned to the top.");
  };

  const onShare = async (c: CommentDTO) => {
    const url = `${window.location.origin}${window.location.pathname}#c${c.id}`;
    try {
      await navigator.clipboard.writeText(url);
      say("Link copied.");
    } catch {
      window.location.hash = `c${c.id}`;
      say("Link is in the address bar.");
    }
  };

  const onReport = async (c: CommentDTO, reason: string) => {
    const r = await reportComment(c.id, reason);
    setReporting(null);
    if (!r.ok) return say(r.error);
    if (r.hidden) setComments((cs) => cs.filter((x) => x.id !== c.id));
    say(r.message);
  };

  const renderTime = (c: CommentDTO) => {
    const d = parseUtc(c.createdAt);
    return (
      <time dateTime={d.toISOString()} title={`${c.createdAt} UTC`} suppressHydrationWarning>
        {now ? timeAgo(d, now) : c.createdAt.slice(0, 10)}
      </time>
    );
  };

  const renderNode = (n: CommentNode): React.ReactNode => {
    const mine = viewer?.id === n.userId;
    const isAdmin = viewer?.role === "admin";
    const closed = collapsed.has(n.id);
    const hasKids = n.children.length > 0;
    const sc = score(n);
    const spoilerHidden = n.spoiler && !revealed.has(n.id) && !mine;
    const votable = !n.deleted && n.status === "visible";
    const voteTitle = (dir: string) => (!viewer ? "Sign in to vote" : mine ? "You cannot vote on your own comment" : dir);
    return (
      <li key={n.id} id={`c${n.id}`} className={`cmt${n.status === "pending" ? " pending" : ""}${n.pinned ? " pinned" : ""}${target === n.id ? " flash" : ""}${n.deleted ? " gone" : ""}${n.depth === 0 ? " top" : ""}`}>
        <div className="cmt-main">
          <div className="cmt-meta">
            <button type="button" className="cmt-fold" aria-expanded={!closed} aria-label={closed ? "Expand thread" : "Collapse thread"} title={closed ? "Expand thread" : "Collapse thread"} onClick={() => toggleCollapsed(n.id)}>
              {closed ? "+" : "\u2212"}
            </button>
            <span className="cmt-user">{n.username}</span>
            {n.role === "admin" && !n.deleted && <span className="tag tag-admin">Admin</span>}
            {n.pinned && <span className="tag tag-pin">Pinned</span>}
            {n.depth === 0 && n.kind !== "comment" && !n.deleted && <span className={`kind${n.kind === "theory" ? " t" : " c"}`}>{KIND_LABEL[n.kind]}</span>}
            {n.spoiler && !n.deleted && <span className="tag tag-spoiler">Spoilers</span>}
            <span className="cmt-dot" aria-hidden="true">&middot;</span>
            {renderTime(n)}
            {n.editedAt && <span className="cmt-edited" title={`Edited ${n.editedAt} UTC`}>(edited)</span>}
            {n.status === "pending" && <span className="pill">awaiting review</span>}
          </div>
          {closed ? (
            <button type="button" className="cmt-more" onClick={() => toggleCollapsed(n.id)}>
              Show {hasKids ? `${countDescendants(n)} ${countDescendants(n) === 1 ? "reply" : "replies"}` : "comment"}
            </button>
          ) : (
            <>
              {editing === n.id ? (
                <Composer
                  mode="edit"
                  kinds={[n.kind]}
                  initial={{ body: n.body, spoiler: n.spoiler, kind: n.kind }}
                  autoFocus
                  label="Edit your post"
                  submit={(d) => editComment({ id: n.id, body: d.body, spoiler: d.spoiler })}
                  onDone={(r) => {
                    upsert(r.comment);
                    setEditing(null);
                    say(r.message);
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : n.deleted ? (
                <p className="cmt-body removed">This comment was removed.</p>
              ) : spoilerHidden ? (
                <button type="button" className="cmt-spoiler" onClick={() => setRevealed((s) => new Set(s).add(n.id))}>
                  Spoiler. Click to read.
                </button>
              ) : (
                <p className="cmt-body">
                  <Highlight text={n.body} query={query} />
                </p>
              )}
              {!n.deleted && editing !== n.id && (
                <div className="cmt-actions">
                  {votable && (
                    <span className="cmt-vote" role="group" aria-label={`Votes, score ${sc}`}>
                      <button type="button" className={`cmt-arrow${n.myVote === 1 ? " on" : ""}`} aria-pressed={n.myVote === 1} aria-label="Upvote" title={voteTitle("Upvote")} disabled={!viewer || mine} onClick={() => void onVote(n, 1)}>
                        <Arrow up />
                      </button>
                      <span className={`cmt-score${sc > 0 ? " pos" : sc < 0 ? " neg" : ""}`} title="Score: upvotes minus downvotes">{sc}</span>
                      <button type="button" className={`cmt-arrow down${n.myVote === -1 ? " on" : ""}`} aria-pressed={n.myVote === -1} aria-label="Downvote" title={voteTitle("Downvote")} disabled={!viewer || mine} onClick={() => void onVote(n, -1)}>
                        <Arrow up={false} />
                      </button>
                    </span>
                  )}
                  {viewer && commentsOn && n.status === "visible" && (
                    <button type="button" onClick={() => setReplyTo(replyTo === n.id ? null : n.id)}>Reply</button>
                  )}
                  {n.status === "visible" && <button type="button" onClick={() => void onShare(n)}>Share</button>}
                  {mine && <button type="button" onClick={() => setEditing(n.id)}>Edit</button>}
                  {(mine || isAdmin) && confirmDelete !== n.id && <button type="button" onClick={() => setConfirmDelete(n.id)}>Delete</button>}
                  {confirmDelete === n.id && (
                    <span className="cmt-confirm">
                      Delete this{hasKids ? " (replies stay)" : ""}?{" "}
                      <button type="button" className="danger" onClick={() => void onDelete(n)}>Yes, delete</button>{" "}
                      <button type="button" onClick={() => setConfirmDelete(null)}>No</button>
                    </span>
                  )}
                  {isAdmin && n.depth === 0 && n.status === "visible" && (
                    <button type="button" onClick={() => void onPin(n)}>{n.pinned ? "Unpin" : "Pin"}</button>
                  )}
                  {viewer && !mine && n.status === "visible" && (
                    <button type="button" className="cmt-report" onClick={() => setReporting(reporting === n.id ? null : n.id)}>
                      <FlagIcon /> Report
                    </button>
                  )}
                </div>
              )}
              {reporting === n.id && (
                <form
                  className="cmt-report-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const reason = new FormData(e.currentTarget).get("reason");
                    if (typeof reason === "string" && reason) void onReport(n, reason);
                  }}
                >
                  <label>
                    Why are you reporting this?
                    <select name="reason" defaultValue="" required>
                      <option value="" disabled>Pick a reason</option>
                      {REPORT_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <button type="submit" className="btn sm">Send report</button>
                  <button type="button" className="btn sm" onClick={() => setReporting(null)}>Cancel</button>
                </form>
              )}
              {replyTo === n.id && (
                <div className="cmt-reply">
                  <Composer
                    mode="reply"
                    kinds={["comment"]}
                    autoFocus
                    label={`Reply to ${n.username}`}
                    submit={(d) => postComment({ tapeId, kind: "comment", body: d.body, parentId: n.id, spoiler: d.spoiler })}
                    onDone={(r) => {
                      upsert(r.comment);
                      setReplyTo(null);
                      say(r.message);
                    }}
                    onCancel={() => setReplyTo(null)}
                  />
                </div>
              )}
              {hasKids && <ul className="cmt-children">{n.children.map(renderNode)}</ul>}
            </>
          )}
        </div>
      </li>
    );
  };

  const canPost = !!viewer && kinds.length > 0;
  return (
    <div className="cmt-section">
      <div className="cmt-head">
        <h3>
          {total} {total === 1 ? "post" : "posts"}
        </h3>
        <div className="cmt-tools">
          <label className="cmt-search">
            <span className="vh">Search this discussion</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this discussion" maxLength={80} />
          </label>
          <label className="cmt-sort">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="chips cmt-tabs" role="group" aria-label="Show">
        {TABS.map(([v, l]) => (
          <button key={v} type="button" className="chip" aria-pressed={kindTab === v} onClick={() => setKindTab(v)}>
            {l} {tabCounts[v]}
          </button>
        ))}
      </div>
      {query.trim() && (
        <p className="cmt-results" role="status">
          {matches.size === 0 ? "No posts match." : `${matches.size} ${matches.size === 1 ? "match" : "matches"}.`}{" "}
          <button type="button" className="linkbtn" onClick={() => setQuery("")}>Clear search</button>
        </p>
      )}

      {canPost ? (
        <div className="cmt-compose">
          <Composer
            mode="post"
            kinds={kinds}
            draftKey={`mc-draft-${tapeId}`}
            submit={(d) => postComment({ tapeId, kind: d.kind, body: d.body, spoiler: d.spoiler })}
            onDone={(r) => upsert(r.comment)}
          />
        </div>
      ) : viewer ? (
        <p className="mute">Posting is turned off right now.</p>
      ) : (
        <p className="cmt-signin">
          <Link href={loginHref}>Sign in</Link> or <Link href={registerHref}>sign up</Link> to post, reply and vote.
        </p>
      )}

      {roots.length === 0 ? (
        <p className="mute cmt-empty">
          {query.trim() ? "Nothing found. Try a different word." : kindTab === "all" ? "Nothing here yet. Be the first to post." : "Nothing in this tab yet."}
        </p>
      ) : (
        <ul className="cmt-list">{roots.map(renderNode)}</ul>
      )}
      <div className="vh" role="status" aria-live="polite">{notice}</div>
      {notice && <div className="cmt-toast" aria-hidden="true">{notice}</div>}
    </div>
  );
}

function countDescendants(n: CommentNode): number {
  return n.children.reduce((a, c) => a + 1 + countDescendants(c), 0);
}
