import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { moderateComment, resolveReports } from "@/app/actions/admin";
import { sql } from "@/lib/db";
import { REPORT_REASONS } from "@/lib/comment-types";

type Row = {
  id: number; tape_id: number; kind: string; body: string; status: string; created_at: string; username: string | null; title: string;
  deleted: number; reports?: number; reasons?: string;
};

const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r[0] === id)?.[1] ?? id;

function Item({ r, reported = false }: { r: Row; reported?: boolean }) {
  const hidden = r.status === "hidden";
  return (
    <div className={`cm${r.status === "pending" ? " pending" : ""}`}>
      <div className="meta">
        <span className={`kind${r.kind === "theory" ? " t" : r.kind === "correction" ? " c" : ""}`}>{r.kind}</span>
        <span>{r.username ?? "[deleted]"}</span>
        <Link href={`/tapes/${r.tape_id}#c${r.id}`}>{r.title}</Link>
        <span>{r.created_at} UTC</span>
        <span className="pill">{r.status}</span>
        {reported && <span className="pill off">{r.reports} {r.reports === 1 ? "report" : "reports"}: {(r.reasons ?? "").split(",").map(reasonLabel).join(", ")}</span>}
      </div>
      <p>{r.body}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {reported && (
          <>
            <form action={resolveReports}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="action" value="dismiss" />
              <button className="btn sm" type="submit">Dismiss reports</button>
            </form>
            {hidden && (
              <form action={resolveReports}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="action" value="restore" />
                <button className="btn sm" type="submit">Restore and dismiss</button>
              </form>
            )}
          </>
        )}
        {(["approve", "hide", "delete"] as const).map((a) =>
          (a === "approve" && r.status === "visible") || (a === "hide" && hidden) || (reported && a === "approve" && hidden) ? null : (
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
  const base = `SELECT c.id, c.tape_id, c.kind, c.body, c.status, c.created_at, c.deleted, u.username, t.title`;
  const from = `FROM comments c LEFT JOIN users u ON u.id = c.user_id JOIN tapes t ON t.id = c.tape_id`;
  const [reported, pending, recent] = await Promise.all([
    sql.all<Row>(
      `${base}, COUNT(r.id) AS reports, GROUP_CONCAT(DISTINCT r.reason) AS reasons
       ${from} JOIN comment_reports r ON r.comment_id = c.id AND r.resolved = 0
       GROUP BY c.id ORDER BY reports DESC, c.created_at DESC LIMIT 100`,
    ),
    sql.all<Row>(`${base} ${from} WHERE c.status = 'pending' ORDER BY c.created_at DESC, c.id DESC LIMIT 100`),
    sql.all<Row>(
      `${base} ${from} WHERE c.status != 'pending' AND c.deleted = 0
         AND c.id NOT IN (SELECT comment_id FROM comment_reports WHERE resolved = 0)
       ORDER BY c.created_at DESC, c.id DESC LIMIT 40`,
    ),
  ]);
  return (
    <>
      <h1>Moderation</h1>
      <p className="intro">Reported comments come first. A comment is hidden on its own once three different people report it; you can restore it here or delete it. Theories and corrections wait until you approve them, and so does a theory whose author edited it.</p>
      <h2 style={{ fontSize: "2rem", textShadow: "none", margin: "22px 0 12px" }}>Reported ({reported.length})</h2>
      {reported.length === 0 && <p className="mute">No open reports.</p>}
      {reported.map((r) => <Item key={r.id} r={r} reported />)}
      <h2 style={{ fontSize: "2rem", textShadow: "none", margin: "32px 0 12px" }}>Awaiting review ({pending.length})</h2>
      {pending.length === 0 && <p className="mute">Nothing waiting.</p>}
      {pending.map((r) => <Item key={r.id} r={r} />)}
      <h2 style={{ fontSize: "2rem", textShadow: "none", margin: "32px 0 12px" }}>Recent posts</h2>
      {recent.length === 0 && <p className="mute">No posts yet.</p>}
      {recent.map((r) => <Item key={r.id} r={r} />)}
    </>
  );
}
