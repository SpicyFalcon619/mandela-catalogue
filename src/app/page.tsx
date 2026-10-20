import Link from "next/link";
import { getCards, getCharacters, getGuide, getQuiz, getSettings, getSources, getTapes, getTheories, STANDING_LABEL } from "@/lib/content";
import { getCommentCounts } from "@/lib/comments";
import { Rich, RichInline } from "@/lib/rich";
import { Hero } from "@/components/Hero";
import { Explorer } from "@/components/Explorer";
import { GuideTabs } from "@/components/GuideTabs";
import { Cases } from "@/components/Cases";
import { Quiz } from "@/components/Quiz";
import { Countdown } from "@/components/Countdown";

export const dynamic = "force-dynamic";

function hms(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
}

export default async function Home() {
  const [s, tapes, premise, themes, mixups, reception, film, guide, characters, quiz, sources, commentCounts, theories] = await Promise.all([
    getSettings(),
    getTapes(),
    getCards("premise"),
    getCards("theme"),
    getCards("mixup"),
    getCards("reception"),
    getCards("film"),
    getGuide(),
    getCharacters(),
    getQuiz(),
    getSources(),
    getCommentCounts(),
    getTheories(),
  ]);
  const on = (k: string) => s[k] === "1";
  // Client components get the tapes without the long explanations; those are read on each tape's own page.
  const lite = tapes.map((t) => ({ ...t, detail: "" }));
  const years = tapes.length ? [...new Set(tapes.map((t) => t.releaseDate.slice(0, 4)))] : [];
  const stats = {
    mains: tapes.filter((t) => t.isMain).length,
    shorts: tapes.filter((t) => !t.isMain).length,
    footage: hms(tapes.reduce((a, t) => a + t.seconds, 0)),
    years: years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : years[0] ?? "",
  };

  return (
    <main>
      <Hero kicker={s.hero_kicker} title1={s.hero_title_1} title2={s.hero_title_2} sub={s.hero_sub} stats={stats} />

      {on("show_premise") && (
        <section id="premise">
          <div className="kicker">Public information</div>
          <h2>{s.premise_title}</h2>
          <p className="lede">{s.premise_lede}</p>
          <div className="premise">
            {premise.map((c) => (
              <div className="pcard" key={c.id}>
                <h3>{c.title}</h3>
                <p><RichInline text={c.body} /></p>
              </div>
            ))}
          </div>
          <p className="mute" style={{ marginTop: 18, fontSize: ".9rem" }}>{s.premise_note}</p>
        </section>
      )}

      {on("show_tapes") && (
        <section id="tapes">
          <Explorer tapes={lite} title={s.tapes_title} lede={s.tapes_lede} commentCounts={commentCounts} />
        </section>
      )}

      {on("show_guide") && (
        <section id="guide">
          <div className="kicker">Field guide</div>
          <h2>{s.guide_title}</h2>
          <GuideTabs tabs={guide} />
        </section>
      )}

      {on("show_files") && (
        <section id="files">
          <div className="kicker">Case files</div>
          <h2>{s.files_title}</h2>
          <p className="lede">{s.files_lede}</p>
          <Cases characters={characters} tapes={lite} />
        </section>
      )}

      {on("show_reading") && (
        <section id="reading">
          <div className="kicker">Reading the series</div>
          <h2>{s.reading_title}</h2>
          <p className="lede">{s.reading_lede}</p>
          <div className="themes">
            {themes.map((c, i) => (
              <div className="theme" key={c.id}>
                {i === 0 && (
                  <svg className="mirror" viewBox="0 0 120 120" aria-hidden="true">
                    <g fill="none" stroke="var(--blue-soft)" strokeWidth="2">
                      <rect x="6" y="6" width="108" height="108" /><rect x="22" y="22" width="76" height="76" />
                      <rect x="36" y="36" width="48" height="48" /><rect x="48" y="48" width="24" height="24" />
                      <rect x="56" y="56" width="8" height="8" stroke="var(--red)" />
                    </g>
                  </svg>
                )}
                <h3>{c.title}</h3>
                <p><RichInline text={c.body} /></p>
              </div>
            ))}
          </div>
          {mixups.length > 0 && (
            <>
              <h3 style={{ marginTop: 44 }}>{s.mixups_title}</h3>
              <div className="cols2">
                {mixups.map((c) => (
                  <div className="mix" key={c.id}>
                    <div className="wrong">{c.title}</div>
                    <p className="right"><RichInline text={c.body} /></p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {on("show_theories") && theories.length > 0 && (
        <section id="theories">
          <div className="kicker">Fan theories</div>
          <h2>{s.theories_title}</h2>
          <p className="lede">{s.theories_lede}</p>
          <div className="theory-grid">
            {theories.map((t) => (
              <Link key={t.id} href={`/theories/${t.id}`} className="theory-card">
                <span className="theory-tags">
                  <span className="tag">Unconfirmed</span>
                  <span className={`tag standing-${t.standing}`}>{STANDING_LABEL[t.standing]}</span>
                </span>
                <h3>{t.title}</h3>
                <p className="spoil">{t.claim}</p>
                <span className="theory-more">Read the case ▶</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {on("show_outside") && (
        <section id="outside">
          <div className="kicker">Outside the tape</div>
          <h2>{s.outside_title}</h2>
          <div className="film">
            <div className="count">
              <div className="cap">{s.film_title}</div>
              <Countdown date={s.film_date} />
              <div className="cap">days to {s.film_date}</div>
              <p className="mute" style={{ fontSize: ".8rem", margin: "12px auto 0" }}>{s.film_note}</p>
            </div>
            <ul className="tl">
              {film.map((c) => (
                <li key={c.id}><b>{c.title}</b><RichInline text={c.body} /></li>
              ))}
            </ul>
          </div>
          <div className="quotes">
            {reception.map((c) => (
              <div className="quote" key={c.id}><b>{c.title}</b><RichInline text={c.body} /></div>
            ))}
          </div>
          <div className="fanwork"><Rich text={s.fan_culture} /></div>
        </section>
      )}

      {on("show_quiz") && (
        <section id="test">
          <div className="kicker">Tracking test</div>
          <h2>{s.quiz_title}</h2>
          <Quiz questions={quiz} />
        </section>
      )}

      {on("show_sources") && (
        <section id="sources">
          <div className="kicker">References</div>
          <h2>{s.sources_title}</h2>
          <p className="lede">{s.sources_lede}</p>
          <ul className="src">
            {sources.map((r) => (
              <li key={r.id}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
                {r.note && <span>{r.note}</span>}
              </li>
            ))}
          </ul>
          <div className="method">
            <h3>{s.method_title}</h3>
            <p>{s.method_note}</p>
          </div>
        </section>
      )}
    </main>
  );
}
