import type Database from "better-sqlite3";
import { DEFAULT_SETTINGS } from "./defaults";
import data from "./seed-data.json";

type RawTape = { id: number; t: string; d: string; len: string; main: boolean; iw: string; iws: number | null; c: string; th: string[]; s: string; n: string };
type RawCase = { n: string; a: string; p: string; ap: number[]; st: string };
type RawQ = { q: string; o: string[]; a: number; n: string };

const GUIDE = [
  {
    label: "Alternates",
    widget: "population",
    body: `Near-immortal shape-shifters. Their goal, as the series presents it, is to wipe out humanity by tormenting people until they die and then taking their identities.

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
    body: `- **M.A.D.:** usually expanded as Metaphysical Awareness Disorder. In *Cognitohazard* a forum user tries to cause it in another. Wikipedia's summary does not define it.
- **Cognitohazard:** a general fiction term for information that harms you by being perceived. Also the title of a 2025 installment.
- **T.H.I.N.K. Principle:** appears as the title of a Vol. 5 segment. My sources do not say what it means.
- **Flawed / Complete / Overdriven:** the three assimilation types named on a USDTP tape in *interlude*.
- **Beginner's Bible:** the in-universe children's video series the Bible retellings imitate.
- **GENESIS APOCRYPHON:** an affiliated channel that hosts short clips such as the Easter clips and *1_19_09 221a*.
- **MandelaTECH:** the county company where Dave Lee is a manager. Its closing-down ad opens *Presto*.
- **Bythorne Paranormal Society:** the investigation group Adam, Jonah and Sarah belong to.`,
    aside_title: "",
    aside_body: "",
  },
];

const CARDS: { kind: string; title: string; body: string }[] = [
  { kind: "premise", title: "Alternates", body: "Near-immortal shape-shifters that imitate people. They want humanity gone: they torment a person until they die, then take that person's identity. They also work through screens, computers and car GPS." },
  { kind: "premise", title: "Gabriel", body: "The leader, shown as a false version of the archangel. The series strongly implies he is Satan. The first video, *overthrone*, has him tell shepherds he is their true savior." },
  { kind: "premise", title: "The Intruder", body: "Tied to television and to the abduction of more than 3,000 children. Per Wikipedia it is not an Alternate and is described as an ally. It tells Adam Murray he is an Alternate." },
  { kind: "theme", title: "Identity", body: "If something has your friend's face, voice and memories, what is left that makes it your friend? Adam's story, and the mirror house in Vol. 6, press hardest on this." },
  { kind: "theme", title: "Evidence", body: "The story is told through recordings, and recordings are exactly what the Alternates corrupt. Tapes degrade, broadcasts lie, and a camcorder dies at the worst moment." },
  { kind: "theme", title: "Faith", body: "Gabriel's impersonation turns a protector into the threat. Kister has said the series reflected his religious doubts and isolation during the COVID-19 pandemic." },
  { kind: "theme", title: "Isolation", body: "Help rarely arrives. The county's population drops from about 15,000 to about 1,000 and the institutions on the tapes (police, hotlines, the county) mostly fail." },
  { kind: "mixup", title: "The Intruder is the main villain.", body: "Gabriel is the leader. The Intruder is described as separate from the Alternates and as an ally, and the two are not established to be the same being." },
  { kind: "mixup", title: "Vol. 4 is mostly Adam and Sarah arguing.", body: "Vol. 4 is a retelling of Genesis. Evelin finds the Stress Assessment tape, Gabriel is revealed as O'Brien and kills Dave Lee, and the Intruder tells Adam he is an Alternate." },
  { kind: "mixup", title: "Presto is Adam and Thatcher debating.", body: "It opens with a MandelaTech going-out-of-business ad. Evelin and Sarah hack cameras and find footage of the two men." },
  { kind: "mixup", title: "It is about Nelson Mandela.", body: "It is set in the fictional Mandela County and named after the Mandela Effect." },
  { kind: "reception", title: "Praise", body: "GQ and Dread Central covered it favorably. Dread Central called it \"the supreme\" example of analog horror. A student paper compared its uncanny-valley approach to The Walten Files." },
  { kind: "reception", title: "Criticism", body: "TLK Magazine praised the worldbuilding but found the voiceover monotone. Vol. 4's green-screen segments drew complaints (Kister says the artificial look is deliberate), and some critics saw overused analog-horror tropes." },
  { kind: "reception", title: "Origin", body: "Kister started it in 2021 at 17 in Richfield, Wisconsin, as his first film project. *overthrone* grew out of a high-school writing project. Thorne Baker wrote *every day gets brighter*, composed the music and voices Thatcher." },
  { kind: "film", title: "May 2025", body: "Kister reveals a screenplay: high-school graduates whose reality unravels after a classmate disappears, mixing live action and found footage." },
  { kind: "film", title: "July 2026", body: "After a bidding war among 11 studios, United Artists (Amazon MGM Studios), Amblin Entertainment and Paper Street Pictures confirm the project. Kister directs from a script co-written with Tyler Clifton." },
  { kind: "film", title: "Producers", body: "Steven Spielberg, Scott Stuber and Aaron B. Koontz are attached." },
  { kind: "film", title: "September 2026", body: "Release date set for June 9, 2028." },
];

const SOURCES = [
  ["The Mandela Catalogue — Wikipedia", "https://en.wikipedia.org/wiki/The_Mandela_Catalogue", "Main source for episode dates, lengths, plot summaries, cast, reception and the film."],
  ["The Mandela Catalogue Wiki (Fandom)", "https://mandela-catalogue.fandom.com/wiki/The_Mandela_Catalogue", "Fan wiki with episode pages. Pages did not load when this site was built, so nothing relies on them."],
  ["Alternates — Fandom wiki", "https://mandela-catalogue.fandom.com/wiki/Alternates", "Creature entries and screenshots."],
  ["Adam Murray — Fandom wiki", "https://mandela-catalogue.fandom.com/wiki/Adam_Murray", "Character page with stills."],
  ["Vol. 6 — Fandom wiki", "https://mandela-catalogue.fandom.com/wiki/The_Mandela_Catalogue_Vol._6", "Page for the latest main volume."],
  ["Vol. 6 — IMDb", "https://www.imdb.com/title/tt39046256/", "Listing with stills."],
  ["overthrone — IMDb Pro", "https://pro.imdb.com/title/tt18829658", "Listing for the first video."],
  ["Mandela Catalogue — TV Tropes", "https://tvtropes.org/pmwiki/pmwiki.php/WebVideo/MandelaCatalogue", "Tropes page; a separate recap page exists."],
  ["The Mandela Catalogue — TheTVDB", "https://thetvdb.com/series/the-mandela-catalogue/allseasons/official", "Episode listing in aired order."],
  ["The Mandela Catalogue — NamuWiki", "https://en.namu.wiki/w/The%20Mandela%20Catalogue", "Long fan-written entry with an episode list."],
];

/** Fills the content tables once, on an empty database. Never touches users or comments. */
export function seedIfEmpty(d: Database.Database) {
  const hasContent = d.prepare("SELECT COUNT(*) AS n FROM tapes").get() as { n: number };
  const insSetting = d.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  // New settings keys added in later versions are filled in on every start.
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);
  if (hasContent.n > 0) return;
  fillContent(d);
}

/** Wipes content (not users) and loads the original data again. */
export function resetContent(d: Database.Database) {
  d.transaction(() => {
    for (const t of ["comments", "tapes", "characters", "quiz", "sources", "guide", "cards"]) d.exec(`DELETE FROM ${t}`);
    d.exec("DELETE FROM sqlite_sequence WHERE name IN ('comments','tapes','characters','quiz','sources','guide','cards')");
    d.exec("DELETE FROM settings");
  })();
  const insSetting = d.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);
  fillContent(d);
}

function fillContent(d: Database.Database) {
  const tapes = data.TAPES as RawTape[];
  const cases = data.CASES as RawCase[];
  const qs = data.QS as RawQ[];
  d.transaction(() => {
    const t = d.prepare(
      "INSERT INTO tapes (id, title, release_date, runtime, is_main, inworld_label, inworld_sort, confidence, threads, summary, note) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    );
    for (const x of tapes) t.run(x.id, x.t, x.d, x.len, x.main ? 1 : 0, x.iw, x.iws, x.c, JSON.stringify(x.th), x.s, x.n);

    const c = d.prepare("INSERT INTO characters (name, actor, bio, status, status_hidden, tape_ids, sort) VALUES (?,?,?,?,?,?,?)");
    cases.forEach((x, i) => {
      const hidden = x.st.includes("redact");
      const status = x.st.replace(/<[^>]+>/g, "").replace(/^Status:\s*/, "");
      c.run(x.n, x.a, x.p, status.charAt(0).toUpperCase() + status.slice(1), hidden ? 1 : 0, JSON.stringify(x.ap), i);
    });

    const q = d.prepare("INSERT INTO quiz (question, options, answer, note, sort) VALUES (?,?,?,?,?)");
    qs.forEach((x, i) => q.run(x.q, JSON.stringify(x.o), x.a, x.n, i));

    const s = d.prepare("INSERT INTO sources (title, url, note, sort) VALUES (?,?,?,?)");
    SOURCES.forEach((x, i) => s.run(x[0], x[1], x[2], i));

    const g = d.prepare("INSERT INTO guide (label, body, aside_title, aside_body, widget, sort) VALUES (?,?,?,?,?,?)");
    GUIDE.forEach((x, i) => g.run(x.label, x.body, x.aside_title, x.aside_body, x.widget, i));

    const k = d.prepare("INSERT INTO cards (kind, title, body, sort) VALUES (?,?,?,?)");
    CARDS.forEach((x, i) => k.run(x.kind, x.title, x.body, i));
  })();
}
