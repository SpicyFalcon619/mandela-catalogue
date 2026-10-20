import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTapes, getTheory, STANDING_LABEL } from "@/lib/content";
import { Rich, RichInline } from "@/lib/rich";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const t = await getTheory(Number((await params).id));
  return { title: t ? `${t.title} · fan theory` : "Theory not found" };
}

export default async function TheoryPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const theory = Number.isInteger(id) ? await getTheory(id) : null;
  if (!theory) notFound();
  const tapes = (await getTapes()).filter((t) => theory.tapeIds.includes(t.id));

  return (
    <main>
      <div className="crumbs"><Link href="/">← Home</Link> · <Link href="/#theories">All theories</Link></div>
      <article className="theory">
        <div className="kicker">FAN THEORY · UNCONFIRMED</div>
        <h1>{theory.title}</h1>
        <p className="theory-tags">
          <span className="tag">Unconfirmed</span>
          <span className={`tag standing-${theory.standing}`}>Tapes lean: {STANDING_LABEL[theory.standing].toLowerCase()}</span>
        </p>
        <p className="mute spoil-hint">This page gives away plot. Click a blurred block to read it.</p>
        <div className="spoil">
          <p className="theory-claim">{theory.claim}</p>
          {theory.body && <Rich text={theory.body} />}
          {theory.support && (
            <>
              <h2 className="rh2">What supports it</h2>
              <Rich text={theory.support} />
            </>
          )}
          {theory.against && (
            <>
              <h2 className="rh2">What argues against it, or is still open</h2>
              <Rich text={theory.against} />
            </>
          )}
        </div>
        {tapes.length > 0 && (
          <>
            <h2 className="rh2">Tapes it is about</h2>
            <ul className="theory-tapes">
              {tapes.map((t) => (
                <li key={t.id}><Link href={`/tapes/${t.id}`}>{t.title}</Link></li>
              ))}
            </ul>
          </>
        )}
        {theory.source && (
          <p className="mute theory-source">
            <b>Where it comes from:</b> <RichInline text={theory.source} /> Nothing here is confirmed by Alex Kister. Post your own take, or push back, in the discussion under any tape.
          </p>
        )}
      </article>
    </main>
  );
}
