import type { Db, Stmt } from "./db";
import { DEFAULT_SETTINGS } from "./defaults";
import data from "./seed-data.json";
import { TAPE_DETAILS } from "./seed-details";
import { THEORIES, type SeedTheory } from "./seed-theories";

type RawTape = { id: number; yt: string; ytc: string; t: string; d: string; len: string; main: boolean; iw: string; iws: number | null; c: string; th: string[]; s: string; n: string };
type RawCase = { n: string; a: string; p: string; ap: number[]; st: string };
type RawQ = { q: string; o: string[]; a: number; n: string };

/** The Vocabulary tab as first published. A database that still has exactly this text is moved to the new wording. */
const OLD_VOCAB_BODY = `- **M.A.D.:** named in *Cognitohazard*, where a forum user tries to cause it in another, and in Wikipedia's entry for Mark Heathcliff, where it drives him to suicide. Wikipedia does not say what the letters stand for, and neither does this guide.
- **Cognitohazard:** a general fiction term for information that harms you by being perceived. Also the title of a 2025 installment.
- **T.H.I.N.K. Principle:** the title of a segment in Vol. 1. Wikipedia says the Alternate N appeared in it before attacking Jude in Vol. 5. My sources do not say what it means.
- **Flawed / Complete / Overdriven:** the three assimilation types named on a USDTP tape in *interlude*.
- **Beginner's Bible:** the in-universe children's video series the Bible retellings imitate.
- **GENESIS APOCRYPHON:** an affiliated channel that hosts short clips such as the Easter clips and *1_19_09 221a*.
- **MandelaTECH:** the county company where Dave Lee is a manager. Its closing-down ad opens *Presto*.
- **Bythorne Paranormal Society:** the investigation group Adam, Jonah and Sarah belong to.`;

const NEW_VOCAB_BODY = `- **M.A.D. (Metaphysical Awareness Disorder):** explained inside the series, in the restored *Vol. 1*, as a severe mental illness caused by "exposure to verbal information that is not desired to be known". The tape says 97% of people diagnosed take their own lives. *Cognitohazard* shows it being spread over a forum, and Wikipedia's entry for Mark Heathcliff names it as what drives him to suicide.
- **Cognitohazard:** a general fiction term for information that harms you by being perceived. Also the title of a 2025 installment.
- **T.H.I.N.K. Principle:** the safety rule taught in *Vol. 1*: Tell an authority figure, Hinder the Alternate's movements, Identify the threat level, Neutralize it if it is safe, Know your place (the words "in reality" are struck through on screen). Wikipedia says the Alternate N appeared in the original segment before attacking Jude in Vol. 5.
- **USDTP:** the United States Department of Temporal Phenomena, the agency behind the Alternate broadcasts and the Television and Mirror Destruction Order.
- **Flawed / Complete / Overdriven:** the three assimilation types named on a USDTP tape in *interlude*. The fan wiki groups Complete with the near-perfect copies (type one) and Flawed and Overdriven with the broken-looking ones (type three).
- **Tulpa:** a fan wiki term for an Alternate imagined into being, as through Stanley's program in *Vol. 333*. The tapes do not use the word.
- **Beginner's Bible:** the in-universe children's video series the Bible retellings imitate.
- **GENESIS APOCRYPHON:** an affiliated channel that hosts short clips such as the Easter clips and *1_19_09 221a*.
- **MandelaTECH:** the county company where Dave Lee is a manager. Its closing-down ad opens *Presto*.
- **Bythorne Paranormal Society:** the investigation group Adam, Jonah and Sarah belong to.`;

const GUIDE = [
  {
    label: "Alternates",
    widget: "population",
    body: `Near-immortal shape-shifters. Wikipedia's summary says their goal is to wipe out humanity by torturing people psychologically to the point of suicide. Some also impersonate people, such as Cesar's Alternate and the one that impersonates Thatcher in *every day gets brighter*.

- They work through screens, computers and vehicle GPS, not only in person.
- Named individuals include the Murray House Alternate, Cesar's Alternate, the Preacher (in the form of an elderly nun) and N.
- The tape *interlude* names three assimilation types: Flawed, Complete and Overdriven. My sources do not define them, so I won't guess.
- Adam Murray appears in Alternate form in Vol. 6.`,
    aside_title: "County population",
    aside_body: "From *interlude*. Bars drawn to scale.",
  },
  {
    label: "Gabriel",
    widget: "none",
    body: `The leader of the Alternates, shown as a false version of the archangel who announces the Messiah. The series heavily implies he is Satan.

- **overthrone:** tells shepherds he is their "true savior."
- **exhibition:** a Beginner's Bible Noah's Ark where Satan promises an Alternate a "last message."
- **Vol. 4:** a retelling of Genesis. Gabriel is revealed as a man named O'Brien and kills Dave Lee.
- **mandela catalyst:** tells Thatcher to "go and see."
- **Easter clips (circa 1995):** "Gabriel" is found in a cave, implying Jesus is in the tomb.`,
    aside_title: "Pattern",
    aside_body:
      "Each Bible retelling is told on a children's tape, and in each one the wrong figure is standing where the messenger should be. The series keeps using the format of trusted media to deliver the lie.",
  },
  {
    label: "The Intruder",
    widget: "none",
    body: `Connected to television and to the abduction of more than 3,000 children. Wikipedia's summary says it is not an Alternate and describes it as an ally.

- **intruder alert:** a smiling face on a TV screen taunts a mother whose child has vanished.
- **Vol. 2:** the same face is on an analog TV in a locked room when Adam enters.
- **Vol. 4:** tells Adam he is an Alternate.
- **1_19_09 221a:** Adam's drawings show Gabriel and the Intruder side by side.`,
    aside_title: "Not established",
    aside_body: "That the Intruder and Gabriel are the same being. That Adam was replaced rather than changed. Both are fan theories.",
  },
  {
    label: "Vocabulary",
    widget: "none",
    body: NEW_VOCAB_BODY,
    aside_title: "",
    aside_body: "",
  },
];

const CARDS: { kind: string; title: string; body: string }[] = [
  { kind: "premise", title: "Alternates", body: "Near-immortal shape-shifters that imitate people. They want humanity gone and torture people psychologically to the point of suicide. They also work through screens, computers and car GPS." },
  { kind: "premise", title: "Gabriel", body: "The leader, shown as a false version of the archangel. The series strongly implies he is Satan. The first video, *overthrone*, has him tell shepherds he is their true savior." },
  { kind: "premise", title: "The Intruder", body: "Tied to television and to the abduction of more than 3,000 children. Per Wikipedia it is not an Alternate and is described as an ally. It tells Adam Murray he is an Alternate." },
  { kind: "theme", title: "Identity", body: "If something has your friend's face, voice and memories, what is left that makes it your friend? Adam's story, and the mirror house in Vol. 6, press hardest on this." },
  { kind: "theme", title: "Evidence", body: "The story is told through recordings, and recordings are exactly what the Alternates corrupt. Tapes degrade, broadcasts lie, and a camcorder dies at the worst moment." },
  { kind: "theme", title: "Faith", body: "Gabriel's impersonation turns a protector into the threat. Per Wikipedia, Kister has said the series began as an outlet for an existential crisis about religion and Christianity, and it was also inspired by the isolation of the COVID-19 pandemic." },
  { kind: "theme", title: "Isolation", body: "Help rarely arrives. The county's population drops from about 15,000 to about 1,000 and the institutions on the tapes (police, hotlines, the county) mostly fail." },
  { kind: "mixup", title: "The Intruder is the main villain.", body: "Gabriel is the leader. The Intruder is described as separate from the Alternates and as an ally, and the two are not established to be the same being." },
  { kind: "mixup", title: "Vol. 4 is mostly Adam and Sarah arguing.", body: "Vol. 4 is a retelling of Genesis. Evelin finds the Stress Assessment tape, Gabriel is revealed as O'Brien and kills Dave Lee, and the Intruder tells Adam he is an Alternate." },
  { kind: "mixup", title: "Presto is Adam and Thatcher debating.", body: "It opens with a MandelaTech going-out-of-business ad. Evelin and Sarah hack cameras and find footage of the two men." },
  { kind: "mixup", title: "It is about Nelson Mandela.", body: "It is set in the fictional Mandela County and named after the Mandela Effect." },
  { kind: "reception", title: "Praise", body: "GQ and Dread Central covered it favorably. Dread Central called it \"the supreme\" example of analog horror. A student paper compared its uncanny-valley approach to The Walten Files." },
  { kind: "reception", title: "Criticism", body: "TLK Magazine praised the worldbuilding but found the voiceover monotone. Vol. 4's green-screen segments drew complaints (Kister says the artificial look is deliberate), and some critics saw overused analog-horror tropes." },
  { kind: "reception", title: "Origin", body: "Kister started it in 2021 at 17 in Richfield, Wisconsin, as his first film project. *overthrone* grew out of a high-school writing project. Thorne Baker wrote *every day gets brighter*, composed the music and voices Thatcher." },
  { kind: "film", title: "May 2025", body: "Kister reveals a screenplay: high-school graduates whose reality unravels after a classmate disappears, mixing live action and found footage." },
  { kind: "film", title: "July 2026", body: "Following a bidding war with 11 other studios, United Artists (Amazon MGM Studios), Amblin Entertainment and Paper Street Pictures confirm the project. Kister directs from a script co-written with Tyler Clifton." },
  { kind: "film", title: "Producers", body: "Steven Spielberg, Scott Stuber and Aaron B. Koontz, among others, are attached." },
  { kind: "film", title: "September 2026", body: "Release date set for June 9, 2028." },
];

const OLD_WIKI_NOTE = "Fan wiki with episode pages. Pages did not load when this site was built, so nothing relies on them.";
const NEW_WIKI_NOTE = "Fan wiki with a page for every video, character and idea. The long tape explanations and the theories on this site are adapted from it and re-worded. Its text is available under CC BY-SA 3.0.";

const wiki = (page: string) => `https://mandela-catalogue.fandom.com/wiki/${page}`;
/** Fan wiki pages the tape explanations and theories lean on, added to existing databases once. */
const EXTRA_SOURCES: [string, string, string][] = [
  ["Canonical System — Fandom wiki", wiki("Canonical_System"), "Which videos count as canon, and which were retired or replaced."],
  ["Sleeper Alternate — Fandom wiki", wiki("Sleeper_Alternate"), "The fan wiki's reading of Adam Murray as a replacement. A theory page, not a statement by the creator."],
  ["Tulpa and The Might of the Subconscious — Fandom wiki", wiki("The_Might_of_the_Subconscious"), "Stanley's program from Vol. 333 and how the wiki classifies what it makes."],
  ["The Preacher — Fandom wiki", wiki("Preacher"), "Appearances of the Preacher and the wiki's speculation about who she was."],
  ["Face Studio 2 — Fandom wiki", wiki("Face_Studio_2"), "The MandelaTECH software from Vol. 4."],
  ["Operation Census — Fandom wiki", wiki("Operation_Census"), "The USDTP operation described on the private tape in Vol. 5."],
];

const SOURCES: [string, string, string][] = [
  ["The Mandela Catalogue — official YouTube playlist", "https://www.youtube.com/playlist?list=PLkk6ZuwrqcsG1CFuI_kjfOVPunfuJEHwj", "The original videos, in order. This is the channel link on Wikipedia's page; the per-tape links on this site point into it."],
  ["The Mandela Catalogue — Wikipedia", "https://en.wikipedia.org/wiki/The_Mandela_Catalogue", "Main source for episode dates, lengths, plot summaries, cast, reception and the film."],
  ["The Mandela Catalogue Wiki (Fandom)", "https://mandela-catalogue.fandom.com/wiki/The_Mandela_Catalogue", NEW_WIKI_NOTE],
  ["Alternates — Fandom wiki", "https://mandela-catalogue.fandom.com/wiki/Alternates", "Creature entries and screenshots."],
  ["Adam Murray — Fandom wiki", "https://mandela-catalogue.fandom.com/wiki/Adam_Murray", "Character page with stills."],
  ["Vol. 6 — Fandom wiki", "https://mandela-catalogue.fandom.com/wiki/The_Mandela_Catalogue_Vol._6", "Page for the latest main volume."],
  ["Vol. 6 — IMDb", "https://www.imdb.com/title/tt39046256/", "Listing with stills."],
  ["overthrone — IMDb Pro", "https://pro.imdb.com/title/tt18829658", "Listing for the first video."],
  ...EXTRA_SOURCES,
  ["Mandela Catalogue — TV Tropes", "https://tvtropes.org/pmwiki/pmwiki.php/WebVideo/MandelaCatalogue", "Tropes page; a separate recap page exists."],
  ["The Mandela Catalogue — TheTVDB", "https://thetvdb.com/series/the-mandela-catalogue/allseasons/official", "Episode listing in aired order."],
  ["The Mandela Catalogue — NamuWiki", "https://en.namu.wiki/w/The%20Mandela%20Catalogue", "Long fan-written entry with an episode list."],
];

const OLD_METHOD_NOTE = "Episode data comes from the Wikipedia article; titles, release dates and runtimes were last checked against its source text on October 20, 2026. In-world dates marked inferred are interpretations of that summary and the episode titles, not stated facts. Wikipedia's summary uses M.A.D. and the T.H.I.N.K. Principle without defining them, so the glossary says so. Plot summaries describe fiction and may contain mistakes, so check them against the tapes.";

/** Fills the content tables once, on an empty database. Never touches users or comments. */
export async function seedIfEmpty(d: Db) {
  const [{ n }, have] = await Promise.all([
    d.get<{ n: number }>("SELECT COUNT(*) AS n FROM tapes").then((r) => r ?? { n: 0 }),
    d.all<{ key: string }>("SELECT key FROM settings"),
  ]);
  // New settings keys added in later versions are filled in on every start.
  await insertMissingSettings(d, new Set(have.map((r) => r.key)));
  if (n > 0) return;
  await d.batch(contentStatements());
}

async function insertMissingSettings(d: Db, have: Set<string>) {
  const missing = Object.entries(DEFAULT_SETTINGS).filter(([k]) => !have.has(k));
  if (missing.length) await d.batch(missing.map(([k, v]) => settingStmt(k, v)));
}

const settingStmt = (k: string, v: string): Stmt => ({ sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", args: [k, v] });

/**
 * Adds the YouTube links to tapes that were seeded before the column existed. Matches on id and title so
 * tapes an admin edited or added are left alone, and never overwrites a link that is already set.
 */
export async function backfillYoutubeLinks(d: Db) {
  await d.batch(
    (data.TAPES as RawTape[]).map((x) => ({
      sql: "UPDATE tapes SET youtube_url = ? WHERE id = ? AND title = ? AND youtube_url = ''",
      args: [x.yt, x.id, x.t],
    })),
  );
}

/** Same idea for the channel credit shown with the embedded video. */
export async function backfillYoutubeChannels(d: Db) {
  await d.batch(
    (data.TAPES as RawTape[]).map((x) => ({
      sql: "UPDATE tapes SET youtube_channel = ? WHERE id = ? AND title = ? AND youtube_channel = ''",
      args: [x.ytc, x.id, x.t],
    })),
  );
}

/** Adds the long explanations to tapes seeded before the column existed. Matches on id and title; never overwrites text. */
export async function backfillTapeDetails(d: Db) {
  await d.batch(
    (data.TAPES as RawTape[])
      .filter((x) => TAPE_DETAILS[x.id])
      .map((x) => ({
        sql: "UPDATE tapes SET detail = ? WHERE id = ? AND title = ? AND detail = ''",
        args: [TAPE_DETAILS[x.id], x.id, x.t],
      })),
  );
}

const EXPANSION_MARKER = "content_expansion_v1";

const theoryArgs = (x: SeedTheory, i: number) => [x.title, x.standing, x.claim, x.body, x.support, x.against, x.source, JSON.stringify(x.tapes), i];
const THEORY_COLS = "title, standing, claim, body, support, against, source, tape_ids, sort";

/**
 * Brings an existing database up to the content added with the theories: the premade theories, the new sources, the
 * Cognitohazard story date and the reworded glossary. Runs once (the marker row), and only on a database that already
 * has tapes: a new database gets all of it from contentStatements(). Text is replaced only where it still equals the old
 * default, so anything an admin edited is left alone. The inserts check the marker inside the same transaction, so two
 * starts racing cannot add things twice.
 */
export async function backfillContentExpansion(d: Db) {
  const [{ n }, done] = await Promise.all([
    d.get<{ n: number }>("SELECT COUNT(*) AS n FROM tapes").then((r) => r ?? { n: 0 }),
    d.get("SELECT 1 AS x FROM settings WHERE key = ?", EXPANSION_MARKER),
  ]);
  if (n === 0 || done) return;
  const unmarked = `WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = '${EXPANSION_MARKER}')`;
  const stmts: Stmt[] = [];
  THEORIES.forEach((x, i) =>
    stmts.push({ sql: `INSERT INTO theories (${THEORY_COLS}) SELECT ?,?,?,?,?,?,?,?,? ${unmarked}`, args: theoryArgs(x, i) }),
  );
  EXTRA_SOURCES.forEach((x, i) =>
    stmts.push({
      sql: `INSERT INTO sources (title, url, note, sort) SELECT ?,?,?,? ${unmarked} AND NOT EXISTS (SELECT 1 FROM sources WHERE url = ?)`,
      args: [x[0], x[1], x[2], SOURCES.length + i, x[1]],
    }),
  );
  stmts.push(
    { sql: "UPDATE guide SET body = ? WHERE label = 'Vocabulary' AND body = ?", args: [NEW_VOCAB_BODY, OLD_VOCAB_BODY] },
    { sql: "UPDATE sources SET note = ? WHERE url = ? AND note = ?", args: [NEW_WIKI_NOTE, wiki("The_Mandela_Catalogue"), OLD_WIKI_NOTE] },
    { sql: "UPDATE settings SET value = ? WHERE key = 'method_note' AND value = ?", args: [DEFAULT_SETTINGS.method_note, OLD_METHOD_NOTE] },
    {
      sql: "UPDATE tapes SET inworld_label = ?, inworld_sort = 2011, confidence = 'stated' WHERE id = 18 AND title = 'Cognitohazard' AND inworld_label = 'Undated'",
      args: ["April 2011 (from the chat dates)"],
    },
    { sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, '1')", args: [EXPANSION_MARKER] },
  );
  await d.batch(stmts);
}

/** Wipes content (not users) and loads the original data again, as one transaction. */
export async function resetContent(d: Db) {
  const wipe: Stmt[] = ["comments", "tapes", "characters", "quiz", "sources", "guide", "cards", "theories"].map((t) => ({ sql: `DELETE FROM ${t}` }));
  wipe.push({ sql: "DELETE FROM sqlite_sequence WHERE name IN ('comments','tapes','characters','quiz','sources','guide','cards','theories')" });
  wipe.push({ sql: "DELETE FROM settings" });
  const settings = Object.entries(DEFAULT_SETTINGS).map(([k, v]) => settingStmt(k, v));
  await d.batch([...wipe, ...settings, ...contentStatements()]);
}

/** Every insert for the original content. Tapes come first: they have fixed ids, so a second seed running at the same
 *  moment fails on the primary key and rolls back, instead of duplicating the other tables. */
function contentStatements(): Stmt[] {
  const tapes = data.TAPES as RawTape[];
  const cases = data.CASES as RawCase[];
  const qs = data.QS as RawQ[];
  const out: Stmt[] = [];
  for (const x of tapes) {
    out.push({
      sql: "INSERT INTO tapes (id, title, release_date, runtime, is_main, inworld_label, inworld_sort, confidence, threads, summary, note, youtube_url, youtube_channel, detail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [x.id, x.t, x.d, x.len, x.main ? 1 : 0, x.iw, x.iws, x.c, JSON.stringify(x.th), x.s, x.n, x.yt, x.ytc, TAPE_DETAILS[x.id] ?? ""],
    });
  }
  cases.forEach((x, i) => {
    const hidden = x.st.includes("redact");
    const status = x.st.replace(/<[^>]+>/g, "").replace(/^Status:\s*/, "");
    out.push({
      sql: "INSERT INTO characters (name, actor, bio, status, status_hidden, tape_ids, sort) VALUES (?,?,?,?,?,?,?)",
      args: [x.n, x.a, x.p, status.charAt(0).toUpperCase() + status.slice(1), hidden ? 1 : 0, JSON.stringify(x.ap), i],
    });
  });
  qs.forEach((x, i) => out.push({ sql: "INSERT INTO quiz (question, options, answer, note, sort) VALUES (?,?,?,?,?)", args: [x.q, JSON.stringify(x.o), x.a, x.n, i] }));
  SOURCES.forEach((x, i) => out.push({ sql: "INSERT INTO sources (title, url, note, sort) VALUES (?,?,?,?)", args: [x[0], x[1], x[2], i] }));
  GUIDE.forEach((x, i) =>
    out.push({
      sql: "INSERT INTO guide (label, body, aside_title, aside_body, widget, sort) VALUES (?,?,?,?,?,?)",
      args: [x.label, x.body, x.aside_title, x.aside_body, x.widget, i],
    }),
  );
  CARDS.forEach((x, i) => out.push({ sql: "INSERT INTO cards (kind, title, body, sort) VALUES (?,?,?,?)", args: [x.kind, x.title, x.body, i] }));
  THEORIES.forEach((x, i) => out.push({ sql: `INSERT INTO theories (${THEORY_COLS}) VALUES (?,?,?,?,?,?,?,?,?)`, args: theoryArgs(x, i) }));
  // A new database already has everything in the expansion; the marker keeps the one-time update from running on it.
  out.push({ sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, '1')", args: [EXPANSION_MARKER] });
  return out;
}
