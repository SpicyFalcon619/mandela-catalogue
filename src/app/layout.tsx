import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { getPrefs } from "@/lib/prefs-server";
import { PrefsProvider } from "@/components/PrefsProvider";
import { TopBar } from "@/components/TopBar";

const FONTS =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Special+Elite&family=VT323&display=swap";

export async function generateMetadata(): Promise<Metadata> {
  const s = getSettings();
  return {
    title: s.site_title,
    description: "An interactive fan field guide to The Mandela Catalogue: every tape, the Alternates, the cast, film news and linked sources.",
    openGraph: { title: s.site_title, type: "website" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0a0b10" };

const HEX = /^#[0-9a-fA-F]{6}$/;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [prefs, user] = await Promise.all([getPrefs(), getUser()]);
  const s = getSettings();
  const sections = [
    ["premise", "Premise", "show_premise"],
    ["tapes", "Tapes", "show_tapes"],
    ["guide", "Field guide", "show_guide"],
    ["files", "Case files", "show_files"],
    ["reading", "Reading it", "show_reading"],
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
          <div className="wrap">
            <TopBar user={user ? { username: user.username, role: user.role } : null} sections={sections} />
            {children}
            <footer>
              <p>{s.content_note}</p>
              <p>{s.credit_line}</p>
              <p>
                {user?.role === "admin" && <><Link href="/admin">Admin</Link> · </>}
                <Link href="/">Home</Link>
              </p>
            </footer>
          </div>
        </PrefsProvider>
      </body>
    </html>
  );
}
