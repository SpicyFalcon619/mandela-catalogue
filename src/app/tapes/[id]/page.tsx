import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { deleteOwnComment } from "@/app/actions/comments";
import { fmtDate } from "@/lib/format";
import { CommentForm } from "@/components/CommentForm";
import { Stills } from "@/components/Stills";
import { WatchLink } from "@/components/WatchLink";
import { getUser } from "@/lib/auth";
import { getCharacters, getSettings, getTape, getTapes } from "@/lib/content";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = { id: number; kind: string; body: string; status: string; created_at: string; user_id: number; username: string };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const t = await getTape(Number((await params).id));
  return { title: t ? `${t.title} · tape ${t.number}` : "Tape not found" };
}

export default async function TapePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const tape = Number.isInteger(id) ? await getTape(id) : null;
  if (!tape) notFound();
  const tapes = await getTapes();
  const i = tapes.findIndex((t) => t.id === tape.id);
  const prev = tapes[i - 1], next = tapes[i + 1];
  const user = await getUser();
  const [s, characters, rows] = await Promise.all([
    getSettings(),
    getCharacters(),
    sql.all<Row>(
      `SELECT c.id, c.kind, c.body, c.status, c.created_at, c.user_id, u.username
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.tape_id = ? AND (c.status = 'visible' OR (c.status = 'pending' AND c.user_id = ?))
       ORDER BY c.created_at DESC, c.id DESC`,
      tape.id,
      user?.id ?? -1,
    ),
  ]);
  const people = characters.filter((c) => c.tapeIds.includes(tape.id));
  const theories = rows.filter((r) => r.kind !== "comment");
  const comments = rows.filter((r) => r.kind === "comment");
  const pad = (n: number) => String(n).padStart(2, "0");

  const Post = ({ r }: { r: Row }) => (
    <div className={`cm${r.status === "pending" ? " pending" : ""}`}>
      <div className="meta">
        <span className={`kind${r.kind === "theory" ? " t" : r.kind === "correction" ? " c" : ""}`}>{r.kind}</span>
        <span>{r.username}</span>
        <span>{r.created_at} UTC</span>
        {r.status === "pending" && <span className="pill">awaiting review</span>}
        {user?.id === r.user_id && (
          <form action={deleteOwnComment.bind(null, r.id, tape.id)}>
            <button type="submit" className="linkbtn">delete</button>
          </form>
        )}
      </div>
      <p>{r.body}</p>
    </div>
  );

  return (
    <main>
      <div className="crumbs"><Link href="/">← All tapes</Link> · <Link href="/#tapes">Tape explorer</Link></div>
      <div className="tpage">
        <div>
          <div className="kicker">TAPE {pad(tape.number)} / {tapes.length} · {tape.isMain ? "MAIN VOLUME" : "SHORTER INSTALLMENT"}</div>
          <h1>{tape.title}</h1>
          <p className="sum spoil">{tape.summary}</p>
          {tape.note && <p className="mute">{tape.note}</p>}
          {tape.youtubeUrl && (
            <p className="acts">
              <WatchLink className="btn watch" href={tape.youtubeUrl} title={tape.title}>Watch the original on YouTube</WatchLink>
            </p>
          )}
          <Stills tapeId={tape.id} label={`TAPE ${pad(tape.number)}`} />
        </div>
        <aside className="side">
          <h3>Details</h3>
          <div className="fact"><b>Released</b>{fmtDate(tape.releaseDate)}</div>
          <div className="fact"><b>Runtime</b>{tape.runtime}</div>
          <div className="fact"><b>In the story</b>{tape.inworldLabel || "Undated"} <span className={`badge${tape.confidence === "stated" ? " s" : ""}`}>{tape.confidence}</span></div>
          {people.length > 0 && (
            <>
              <h3>Seen in this tape</h3>
              <ul>{people.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
            </>
          )}
        </aside>
      </div>

      <div className="tnav">
        {prev ? <Link className="btn" href={`/tapes/${prev.id}`}>◀◀ {prev.title}</Link> : <span />}
        {next ? <Link className="btn" href={`/tapes/${next.id}`}>{next.title} ▶▶</Link> : <span />}
      </div>

      <section className="cmts" id="posts">
        <div className="kicker">The community</div>
        <h2 style={{ fontSize: "3rem" }}>Theories and comments</h2>
        {user ? (
          <div style={{ marginTop: 20 }}>
            <CommentForm tapeId={tape.id} comments={s.comments_enabled === "1"} submissions={s.submissions_enabled === "1"} />
          </div>
        ) : (
          <p style={{ marginTop: 14 }}>
            <Link href={`/login?next=${encodeURIComponent(`/tapes/${tape.id}`)}`}>Sign in</Link> or <Link href={`/register?next=${encodeURIComponent(`/tapes/${tape.id}`)}`}>sign up</Link> to post.
          </p>
        )}
        {theories.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 12 }}>Fan theories and corrections</h3>
            {theories.map((r) => <Post key={r.id} r={r} />)}
          </div>
        )}
        <div style={{ marginTop: 28 }}>
          <h3 style={{ marginBottom: 12 }}>Comments</h3>
          {comments.length === 0 && <p className="mute">No comments yet.</p>}
          {comments.map((r) => <Post key={r.id} r={r} />)}
        </div>
      </section>
    </main>
  );
}
