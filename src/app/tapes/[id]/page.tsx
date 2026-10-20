import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fmtDate } from "@/lib/format";
import { CommentSection } from "@/components/CommentSection";
import { Stills } from "@/components/Stills";
import { VideoEmbed } from "@/components/VideoEmbed";
import { WatchLink } from "@/components/WatchLink";
import { getUser } from "@/lib/auth";
import { getCharacters, getSettings, getTape, getTapes, getTheories } from "@/lib/content";
import { Rich } from "@/lib/rich";
import { Collapsible } from "@/components/Collapsible";
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
  const [s, characters, thread, theories] = await Promise.all([getSettings(), getCharacters(), getThread(tape.id, user), getTheories()]);
  const related = theories.filter((t) => t.tapeIds.includes(tape.id));
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
          {tape.youtubeId && <VideoEmbed id={tape.youtubeId} title={tape.title} watchUrl={tape.youtubeUrl} channel={tape.youtubeChannel} />}
          <p className="sum spoil">{tape.summary}</p>
          {tape.note && <p className="mute">{tape.note}</p>}
          {tape.youtubeUrl && (
            <p className="acts">
              <WatchLink className="btn watch" href={tape.youtubeUrl} title={tape.title}>Watch the original on YouTube</WatchLink>
            </p>
          )}
          {tape.detail && (
            <Collapsible id="detail" kicker="In depth" title="The full explanation" hint="What happens, who is in it, where it fits, what it settles and what it leaves open. Spoilers.">
              <p className="mute spoil-hint">It gives away the whole tape, so it stays blurred until you click it.</p>
              <div className="detail-body spoil"><Rich text={tape.detail} /></div>
            </Collapsible>
          )}
          {related.length > 0 && (
            <section className="detail" id="theories" aria-labelledby="theories-h">
              <div className="kicker">Fan theories · unconfirmed</div>
              <h2 id="theories-h">Theories about this tape</h2>
              <ul className="theory-links">
                {related.map((t) => (
                  <li key={t.id}><Link href={`/theories/${t.id}`}>{t.title}</Link></li>
                ))}
              </ul>
            </section>
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
