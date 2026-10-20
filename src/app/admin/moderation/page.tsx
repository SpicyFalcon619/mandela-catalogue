import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { moderateComment } from "@/app/actions/admin";
import { db } from "@/lib/db";

type Row = { id: number; tape_id: number; kind: string; body: string; status: string; created_at: string; username: string; title: string };

function Item({ r }: { r: Row }) {
  return (
    <div className={`cm${r.status === "pending" ? " pending" : ""}`}>
      <div className="meta">
        <span className={`kind${r.kind === "theory" ? " t" : r.kind === "correction" ? " c" : ""}`}>{r.kind}</span>
        <span>{r.username}</span>
        <Link href={`/tapes/${r.tape_id}`}>{r.title}</Link>
        <span>{r.created_at} UTC</span>
        <span className="pill">{r.status}</span>
      </div>
      <p>{r.body}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {(["approve", "hide", "delete"] as const).map((a) =>
          (a === "approve" && r.status === "visible") || (a === "hide" && r.status === "hidden") ? null : (
            <form key={a} action={moderateComment}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="tape_id" value={r.tape_id} />
              <input type="hidden" name="action" value={a} />
              <button className={`btn sm${a === "delete" ? " danger" : ""}`} type="submit">{a === "approve" ? "Approve" : a === "hide" ? "Hide" : "Delete"}</button>
            </form>
          ),
        )}
      </div>
    </div>
  );
}

export default async function Moderation() {
  await requireAdmin(); // pages check too: layouts are not re-run on client-side navigation
  const q = (where: string, limit: number) =>
    db()
      .prepare(
        `SELECT c.id, c.tape_id, c.kind, c.body, c.status, c.created_at, u.username, t.title FROM comments c JOIN users u ON u.id = c.user_id JOIN tapes t ON t.id = c.tape_id WHERE ${where} ORDER BY c.created_at DESC, c.id DESC LIMIT ${limit}`,
      )
      .all() as Row[];
  const pending = q("c.status = 'pending'", 100);
  const recent = q("c.status != 'pending'", 40);
  return (
    <>
      <h1>Moderation</h1>
      <p className="intro">Theories and corrections wait here until you approve them. Comments go live immediately; hide or delete them below.</p>
      <h2 style={{ fontSize: "2rem", textShadow: "none", margin: "22px 0 12px" }}>Awaiting review ({pending.length})</h2>
      {pending.length === 0 && <p className="mute">Nothing waiting.</p>}
      {pending.map((r) => <Item key={r.id} r={r} />)}
      <h2 style={{ fontSize: "2rem", textShadow: "none", margin: "32px 0 12px" }}>Recent posts</h2>
      {recent.length === 0 && <p className="mute">No posts yet.</p>}
      {recent.map((r) => <Item key={r.id} r={r} />)}
    </>
  );
}
