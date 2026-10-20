"use client";

import { useEffect } from "react";
import { FONTS, FX_LEVELS, SIZES, THEMES } from "@/lib/prefs";
import { usePrefs } from "./PrefsProvider";

const SWATCH: Record<string, string> = { tape: "#2a3cf5", phosphor: "#4dffa0", amber: "#ffb800", mono: "#bdbdbd", paper: "#ece6d6" };

export function SettingsPanel({ onClose, signedIn }: { onClose: () => void; signedIn: boolean }) {
  const { prefs, set } = usePrefs();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Display settings">
        <button type="button" className="btn sm close" onClick={onClose}>
          Close
        </button>
        <h2>Display</h2>
        <p className="mute" style={{ fontSize: ".85rem" }}>
          {signedIn ? "Saved to your account and this browser." : "Saved in this browser. Sign in to keep them on every device."}
        </p>

        <fieldset className="opt-group">
          <legend>Theme</legend>
          <div className="opt-row">
            {THEMES.map((t) => (
              <label key={t.id} className="choice">
                <input type="radio" name="theme" checked={prefs.theme === t.id} onChange={() => set({ theme: t.id })} />
                <span className="swatch" style={{ background: SWATCH[t.id] }} /> {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="opt-group">
          <legend>Effects</legend>
          <div className="opt-row">
            {FX_LEVELS.map((f) => (
              <label key={f.id} className="choice">
                <input type="radio" name="fx" checked={prefs.fx === f.id} onChange={() => set({ fx: f.id })} /> {f.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="opt-group">
          <legend>Typeface</legend>
          <div className="opt-row">
            {FONTS.map((f) => (
              <label key={f.id} className="choice">
                <input type="radio" name="font" checked={prefs.font === f.id} onChange={() => set({ font: f.id })} /> {f.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="opt-group">
          <legend>Text size</legend>
          <div className="opt-row">
            {SIZES.map((f) => (
              <label key={f.id} className="choice">
                <input type="radio" name="size" checked={prefs.size === f.id} onChange={() => set({ size: f.id })} /> {f.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="opt-group">
          <legend>Tape shelf</legend>
          <div className="opt-row">
            <label className="choice">
              <input type="radio" name="shelf" checked={prefs.shelf === "grid"} onChange={() => set({ shelf: "grid" })} /> Cassette grid
            </label>
            <label className="choice">
              <input type="radio" name="shelf" checked={prefs.shelf === "list"} onChange={() => set({ shelf: "list" })} /> Compact list
            </label>
          </div>
        </fieldset>

        <fieldset className="opt-group">
          <legend>Spoilers</legend>
          <label className="choice">
            <input type="checkbox" checked={prefs.spoilers} onChange={(e) => set({ spoilers: e.target.checked })} /> Blur plot summaries until clicked
          </label>
        </fieldset>
      </aside>
    </>
  );
}
