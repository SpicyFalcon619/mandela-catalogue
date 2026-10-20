import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fmtDate } from "@/lib/format";
import { CommentSection } from "@/components/CommentSection";
import { Stills } from "@/components/Stills";
import { WatchLink } from "@/components/WatchLink";
import { getUser } from "@/lib/auth";
import { getCharacters, getSettings, getTape, getTapes } from "@/lib/content";
import { getThread } from "@/lib/comments";

export const dynamic = "force-dynamic";

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
  const [s, characters, thread] = await Promise.all([getSettings(), getCharacters(), getThread(tape.id, user)]);
  const people = characters.filter((c) => c.tapeIds.includes(tape.id));
  const pad = (n: number) => String(n).padStart(2, "0");
  const here = `/tapes/${tape.id}`;

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
        <CommentSection
          tapeId={tape.id}
          initial={thread}
          viewer={user ? { id: user.id, username: user.username, role: user.role } : null}
          commentsOn={s.comments_enabled === "1"}
          submissionsOn={s.submissions_enabled === "1"}
          loginHref={`/login?next=${encodeURIComponent(here)}`}
          registerHref={`/register?next=${encodeURIComponent(here)}`}
        />
      </section>
    </main>
  );
}
