import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveEntity } from "@/app/actions/admin";
import { getTapes } from "@/lib/content";
import { db } from "@/lib/db";
import { entityByKey, type Field } from "@/lib/entities";

type Row = Record<string, unknown>;

function parseArr(v: unknown): string[] {
  try {
    const a = JSON.parse(String(v ?? "[]"));
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
}

function Input({ f, row, tapeOptions }: { f: Field; row: Row | null; tapeOptions: { id: number; label: string }[] }) {
  const raw = row ? row[f.name] : undefined;
  switch (f.type) {
    case "bool":
      return (
        <label className="bool">
          <input type="checkbox" name={f.name} defaultChecked={row ? !!raw : f.name === "published"} /> {f.label}
        </label>
      );
    case "textarea":
      return (
        <label>
          {f.label}
          <textarea name={f.name} defaultValue={String(raw ?? "")} />
          {f.help && <small>{f.help}</small>}
        </label>
      );
    case "number": {
      const shown = raw === null || raw === undefined ? "" : String(Number(raw) - (f.offset ?? 0));
      return (
        <label>
          {f.label}
          <input type="number" step="any" name={f.name} defaultValue={row ? shown : f.name === "sort" ? "0" : ""} />
          {f.help && <small>{f.help}</small>}
        </label>
      );
    }
    case "select":
      return (
        <label>
          {f.label}
          <select name={f.name} defaultValue={String(raw ?? f.options?.[0]?.[0] ?? "")}>
            {(f.options ?? []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      );
    case "tags": {
      const on = new Set(parseArr(raw));
      return (
        <div className="lbl2">
          {f.label}
          <div className="checks">
            {(f.options ?? []).map(([v, l]) => (
              <label key={v}><input type="checkbox" name={f.name} value={v} defaultChecked={on.has(v)} /> {l}</label>
            ))}
          </div>
        </div>
      );
    }
    case "tapes": {
      const on = new Set(parseArr(raw));
      return (
        <div className="lbl2">
          {f.label}
          <div className="checks">
            {tapeOptions.map((t) => (
              <label key={t.id}><input type="checkbox" name={f.name} value={t.id} defaultChecked={on.has(String(t.id))} /> {t.label}</label>
            ))}
          </div>
        </div>
      );
    }
    case "lines":
      return (
        <label>
          {f.label}
          <textarea name={f.name} defaultValue={parseArr(raw).join("\n")} />
        </label>
      );
    default:
      return (
        <label>
          {f.label}
          <input type="text" name={f.name} defaultValue={String(raw ?? "")} placeholder={f.placeholder} />
          {f.help && <small>{f.help}</small>}
        </label>
      );
  }
}

export default async function EntityEdit({ params, searchParams }: { params: Promise<{ entity: string; id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireAdmin(); // pages check too: layouts are not re-run on client-side navigation
  const { entity: key, id } = await params;
  const sp = await searchParams;
  const entity = entityByKey(key);
  if (!entity) notFound();
  let row: Row | null = null;
  if (id !== "new") {
    const n = Number(id);
    if (!Number.isInteger(n)) notFound();
    row = (db().prepare(`SELECT * FROM ${entity.table} WHERE id = ?`).get(n) as Row | undefined) ?? null;
    if (!row) notFound();
  }
  const tapeOptions = getTapes().map((t) => ({ id: t.id, label: `${String(t.number).padStart(2, "0")} ${t.title}` }));
  return (
    <>
      <h1>{row ? `Edit ${entity.singular}` : `New ${entity.singular}`}</h1>
      {sp.error && <div className="flash bad" role="alert">{sp.error}</div>}
      <form action={saveEntity.bind(null, entity.key)} className="form wide" style={{ marginTop: 18 }}>
        <input type="hidden" name="id" value={row ? String(row.id) : "new"} />
        {entity.fields.map((f) => <Input key={f.name} f={f} row={row} tapeOptions={tapeOptions} />)}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn fill" type="submit">Save</button>
          <Link className="btn" href={`/admin/${entity.key}`}>Cancel</Link>
        </div>
      </form>
    </>
  );
}
