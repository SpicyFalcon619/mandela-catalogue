import { requireAdmin } from "@/lib/auth";
import { saveSettings } from "@/app/actions/admin";
import { getSettings } from "@/lib/content";
import { SETTING_FIELDS } from "@/lib/defaults";
import { THEMES } from "@/lib/prefs";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin(); // pages check too: layouts are not re-run on client-side navigation
  const sp = await searchParams;
  const s = await getSettings();
  const groups = [...new Set(SETTING_FIELDS.map((f) => f.group))];
  return (
    <>
      <h1>Site settings</h1>
      <p className="intro">Wording, colors, which sections show, and what visitors can do. Visitors can still change their own theme, font and effects from the Display button.</p>
      {sp.saved && <div className="flash">Saved.</div>}
      <form action={saveSettings} className="form wide">
        {groups.map((g) => (
          <div className="sgroup" key={g}>
            <h2>{g}</h2>
            <div className={g === "Section text" || g === "Hero" || g === "Footer" ? "form wide" : "grid2"} style={g === "Section text" || g === "Hero" || g === "Footer" ? undefined : { display: "grid" }}>
              {SETTING_FIELDS.filter((f) => f.group === g).map((f) => {
                const v = s[f.key] ?? "";
                if (f.kind === "bool") return <label className="bool" key={f.key}><input type="checkbox" name={f.key} defaultChecked={v === "1"} /> {f.label}</label>;
                if (f.kind === "textarea") return <label key={f.key}>{f.label}<textarea name={f.key} defaultValue={v} /></label>;
                if (f.kind === "color") return <label key={f.key}>{f.label}<input type="color" name={f.key} defaultValue={v} /></label>;
                if (f.kind === "date") return <label key={f.key}>{f.label}<input type="date" name={f.key} defaultValue={v} /></label>;
                if (f.kind === "theme")
                  return (
                    <label key={f.key}>
                      {f.label}
                      <select name={f.key} defaultValue={v}>{THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                    </label>
                  );
                return <label key={f.key}>{f.label}<input type="text" name={f.key} defaultValue={v} /></label>;
              })}
            </div>
          </div>
        ))}
        <div><button className="btn fill" type="submit">Save settings</button></div>
      </form>
    </>
  );
}
