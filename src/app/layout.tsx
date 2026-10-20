import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { countUnreadReplies } from "@/lib/comments";
import { getPrefs } from "@/lib/prefs-server";
import { PrefsProvider } from "@/components/PrefsProvider";
import { BackToTop } from "@/components/BackToTop";
import { TopBar } from "@/components/TopBar";

const FONTS =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Special+Elite&family=VT323&display=swap";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: s.site_title,
    description: "An interactive fan field guide to The Mandela Catalogue: every tape, the Alternates, the cast, film news and linked sources.",
    openGraph: { title: s.site_title, type: "website" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0a0b10" };

const HEX = /^#[0-9a-fA-F]{6}$/;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [prefs, user, s] = await Promise.all([getPrefs(), getUser(), getSettings()]);
  const unread = user ? await countUnreadReplies(user.id) : 0;
  const sections = [
    ["premise", "Premise", "show_premise"],
    ["tapes", "Tapes", "show_tapes"],
    ["guide", "Field guide", "show_guide"],
    ["files", "Case files", "show_files"],
    ["reading", "Reading it", "show_reading"],
    ["theories", "Theories", "show_theories"],
    ["outside", "Outside", "show_outside"],
    ["test", "Test", "show_quiz"],
    ["sources", "Sources", "show_sources"],
  ]
    .filter(([, , key]) => s[key] === "1")
    .map(([id, label]) => ({ id, label }));
  const accent = HEX.test(s.accent_red) && HEX.test(s.accent_blue) && HEX.test(s.accent_amber)
    ? `:root[data-theme="tape"]{--red:${s.accent_red};--blue:${s.accent_blue};--amber:${s.accent_amber}}`
    : "";

  return (
    <html
      lang="en"
      data-theme={prefs.theme}
      data-fx={prefs.fx}
      data-font={prefs.font}
      data-size={prefs.size}
      data-spoilers={prefs.spoilers ? "on" : "off"}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
        {accent && <style dangerouslySetInnerHTML={{ __html: accent }} />}
      </head>
      <body>
        <PrefsProvider initial={prefs}>
          <a className="skip" href="#content">Skip to content</a>
          <div className="wrap">
            <TopBar user={user ? { username: user.username, role: user.role } : null} sections={sections} unread={unread} />
            <div id="content" tabIndex={-1}>
              {children}
            </div>
            <footer className="site-foot">
              <div className="foot-grid">
                <div className="foot-note">
                  <p>{s.content_note}</p>
                  <p className="foot-credit">{s.credit_line}</p>
                </div>
                <nav className="foot-links" aria-label="Site">
                  <Link href="/">Home</Link>
                  <Link href="/#tapes">All tapes</Link>
                  <Link href="/search">Search</Link>
                  <Link href="/#sources">Sources</Link>
                  <a href="https://github.com/SpicyFalcon619/mandela-catalogue" target="_blank" rel="noopener noreferrer">Source code</a>
                  <a href="https://github.com/SpicyFalcon619/mandela-catalogue/issues/new" target="_blank" rel="noopener noreferrer">Report a mistake</a>
                  {user?.role === "admin" && <Link href="/admin">Admin</Link>}
                </nav>
              </div>
            </footer>
          </div>
          <BackToTop />
        </PrefsProvider>
      </body>
    </html>
  );
}
