"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { SettingsPanel } from "./SettingsPanel";

type Props = { user: { username: string; role: string } | null; sections: { id: string; label: string }[] };

function hms(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
}

export function TopBar({ user, sections }: Props) {
  const path = usePathname();
  const home = path === "/";
  const [open, setOpen] = useState(false);
  const [secs, setSecs] = useState(0);
  const [active, setActive] = useState("");

  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!home || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-30% 0px -60% 0px" },
    );
    document.querySelectorAll("section[id]").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [home]);

  return (
    <>
      <header className="osd" role="banner">
        <Link className="play" href="/" aria-label="Home">
          <i>●</i> PLAY SP
        </Link>
        <nav aria-label="Sections">
          {sections.map((s) => (
            <Link key={s.id} href={`/#${s.id}`} className={home && active === s.id ? "on" : undefined}>
              {s.label}
            </Link>
          ))}
        </nav>
        <div className="tools2">
          <span className="ctr">{hms(secs)}</span>
          <button type="button" className="btn2" onClick={() => setOpen(true)}>
            Display
          </button>
          {user ? (
            <>
              {user.role === "admin" && (
                <Link className="btn2" href="/admin">
                  Admin
                </Link>
              )}
              <span className="who">{user.username}</span>
              <Link className="btn2" href="/account">
                Account
              </Link>
              <form action={logoutAction} style={{ display: "inline" }}>
                <button type="submit" className="btn2">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="btn2" href="/login">
                Sign in
              </Link>
              <Link className="btn2" href="/register">
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>
      {open && <SettingsPanel signedIn={!!user} onClose={() => setOpen(false)} />}
    </>
  );
}
