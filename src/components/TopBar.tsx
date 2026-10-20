"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { SettingsPanel } from "./SettingsPanel";

type Props = {
  user: { username: string; role: string } | null;
  sections: { id: string; label: string }[];
  unread?: number;
};

const icon = { viewBox: "0 0 20 20", width: 20, height: 20, fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "square" as const, "aria-hidden": true, focusable: false };

function SearchIcon() {
  return (
    <svg {...icon}>
      <circle cx="8.5" cy="8.5" r="5.2" />
      <path d="M12.5 12.5L17 17" />
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg {...icon}>
      <path d="M3 6h14M3 14h14" />
      <rect x="11" y="3.6" width="3" height="4.8" fill="currentColor" stroke="none" />
      <rect x="6" y="11.6" width="3" height="4.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
function MenuIcon({ open }: { open: boolean }) {
  return <svg {...icon}>{open ? <path d="M4 4l12 12M16 4L4 16" /> : <path d="M3 5h14M3 10h14M3 15h14" />}</svg>;
}
function Chevron() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
      <path d="M2 4.5l4 4 4-4" />
    </svg>
  );
}

export function TopBar({ user, sections, unread = 0 }: Props) {
  const path = usePathname();
  const home = path === "/";
  const [settings, setSettings] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [account, setAccount] = useState(false);
  const [active, setActive] = useState("");
  const accountRef = useRef<HTMLDivElement>(null);

  // Which home page section is on screen, for the highlight in the bar.
  useEffect(() => {
    if (!home || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-30% 0px -60% 0px" });
    document.querySelectorAll("section[id]").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [home]);

  // Menus close when you go to another page, press Escape, or click elsewhere.
  useEffect(() => {
    setSheet(false);
    setAccount(false);
  }, [path]);
  useEffect(() => {
    if (!sheet && !account) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSheet(false);
        setAccount(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (account && accountRef.current && !accountRef.current.contains(e.target as Node)) setAccount(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [sheet, account]);

  const initial = user ? user.username.slice(0, 1) : "";
  return (
    <>
      <header className="nav" role="banner">
        <div className="nav-inner">
          <Link className="nav-brand" href="/" aria-label="The Mandela Catalogue field guide, home">
            <i className="rec" aria-hidden="true" />
            <span>Mandela Catalogue</span>
          </Link>

          <nav className="nav-links" aria-label="Sections">
            {sections.map((s) => (
              <Link key={s.id} href={`/#${s.id}`} className={home && active === s.id ? "on" : undefined} aria-current={home && active === s.id ? "location" : undefined}>
                {s.label}
              </Link>
            ))}
          </nav>

          <div className="nav-tools">
            <Link className="nav-icon" href="/search" aria-label="Search" title="Search">
              <SearchIcon />
            </Link>
            <button type="button" className="nav-icon" aria-label="Display" title="Display: theme, text size, effects, spoilers" onClick={() => setSettings(true)}>
              <SlidersIcon />
            </button>

            {user ? (
              <div className="nav-account" ref={accountRef}>
                <button type="button" className="nav-user" aria-expanded={account} aria-controls="account-menu" aria-label="Your account menu" onClick={() => setAccount((v) => !v)}>
                  <span className="nav-avatar" aria-hidden="true">{initial}</span>
                  <span className="who">{user.username}</span>
                  <Chevron />
                  {unread > 0 && <span className="badge-n" aria-label={`${unread} unread ${unread === 1 ? "reply" : "replies"}`}>{unread > 99 ? "99+" : unread}</span>}
                </button>
                {account && (
                  <div className="nav-menu" id="account-menu">
                    <div className="nav-menu-head">
                      Signed in as <b>{user.username}</b>
                      {user.role === "admin" && <span className="tag tag-admin">Admin</span>}
                    </div>
                    <Link href={unread > 0 ? "/account#replies" : "/account"} onClick={() => setAccount(false)}>
                      Account{unread > 0 ? <span className="nav-menu-note">{unread} new {unread === 1 ? "reply" : "replies"}</span> : null}
                    </Link>
                    {user.role === "admin" && <Link href="/admin" onClick={() => setAccount(false)}>Admin</Link>}
                    <form action={logoutAction}>
                      <button type="submit">Sign out</button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link className="nav-link" href="/login">Sign in</Link>
                <Link className="nav-cta" href="/register">Sign up</Link>
              </>
            )}

            <button type="button" className="nav-icon nav-burger" aria-label="Menu" aria-expanded={sheet} aria-controls="nav-sheet" onClick={() => setSheet((v) => !v)}>
              <MenuIcon open={sheet} />
            </button>
          </div>
        </div>

        {sheet && (
          <div className="nav-sheet" id="nav-sheet">
            <p className="nav-sheet-label">Jump to</p>
            <ul>
              {sections.map((s) => (
                <li key={s.id}>
                  <Link href={`/#${s.id}`} className={home && active === s.id ? "on" : undefined} onClick={() => setSheet(false)}>{s.label}</Link>
                </li>
              ))}
            </ul>
            <p className="nav-sheet-label">More</p>
            <ul>
              <li><Link href="/search" onClick={() => setSheet(false)}>Search</Link></li>
              {!user && <li><Link href="/login" onClick={() => setSheet(false)}>Sign in</Link></li>}
              {!user && <li><Link href="/register" onClick={() => setSheet(false)}>Sign up</Link></li>}
            </ul>
          </div>
        )}
      </header>
      {settings && <SettingsPanel signedIn={!!user} onClose={() => setSettings(false)} />}
    </>
  );
}
