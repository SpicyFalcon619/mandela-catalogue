import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEntity } from "@/app/actions/admin";
import { db } from "@/lib/db";
import { entityByKey } from "@/lib/entities";

function cell(v: unknown, type: string) {
  if (type === "bool") return <span className={`pill ${v ? "on" : "off"}`}>{v ? "yes" : "no"}</span>;
  const s = v === null || v === undefined ? "" : String(v);
  return s.length > 90 ? s.slice(0, 90) + "…" : s;
}

export default async function EntityList({ params, searchParams }: { params: Promise<{ entity: string }>; searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  await requireAdmin(); // pages check too: layouts are not re-run on client-side navigation
  const { entity: key } = await params;
  const sp = await searchParams;
  const entity = entityByKey(key);
  if (!entity) notFound();
  const rows = db().prepare(`SELECT * FROM ${entity.table} ORDER BY ${entity.orderBy}`).all() as Record<string, unknown>[];
  const cols = entity.columns.map((c) => entity.fields.find((f) => f.name === c)!).filter(Boolean);
  return (
    <>
      <h1>{entity.label}</h1>
      <p className="intro">{entity.intro}</p>
      {sp.saved && <div className="flash">Saved.</div>}
      {sp.deleted && <div className="flash">Deleted.</div>}
      <p><Link className="btn fill" href={`/admin/${entity.key}/new`}>Add {entity.singular}</Link></p>
      <div className="atable-wrap">
        <table className="atable">
          <thead>
            <tr>{cols.map((c) => <th key={c.name}>{c.label.split(" (")[0]}</th>)}<th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                {cols.map((c) => <td key={c.name}>{cell(c.name === "answer" ? Number(r.answer) + 1 : r[c.name], c.type)}</td>)}
                <td className="act">
                  <Link className="btn sm" href={`/admin/${entity.key}/${r.id}`}>Edit</Link>{" "}
                  <form action={deleteEntity.bind(null, entity.key)}>
                    <input type="hidden" name="id" value={String(r.id)} />
                    <button className="btn sm danger" type="submit">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="mute">Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
