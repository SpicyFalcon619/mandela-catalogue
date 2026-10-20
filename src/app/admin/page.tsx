import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { resetAllContent } from "@/app/actions/admin";
import { db } from "@/lib/db";
import { ENTITIES } from "@/lib/entities";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  await requireAdmin(); // pages check too: layouts are not re-run on client-side navigation
  const sp = await searchParams;
  const count = (t: string) => (db().prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  const pending = (db().prepare("SELECT COUNT(*) AS n FROM comments WHERE status = 'pending'").get() as { n: number }).n;
  return (
    <>
      <h1>Admin</h1>
      <p className="intro">Everything on the public site is edited here. Changes show up immediately.</p>
      {sp.reset && <div className="flash">Content was reset to the original data.</div>}
      {sp.error && <div className="flash bad">{sp.error}</div>}
      <div className="statrow">
        {ENTITIES.map((e) => (
          <Link key={e.key} href={`/admin/${e.key}`} className="stat" style={{ textDecoration: "none", color: "inherit" }}>
            <b>{count(e.table)}</b>
            <span>{e.label}</span>
          </Link>
        ))}
        <Link href="/admin/moderation" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
          <b>{pending}</b>
          <span>Awaiting review</span>
        </Link>
        <Link href="/admin/users" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
          <b>{count("users")}</b>
          <span>Users</span>
        </Link>
      </div>
      <div className="sgroup">
        <h2>Reset content</h2>
        <p className="intro">Deletes all tapes, case files, quiz questions, sources, guide tabs, cards, site settings and comments, then reloads the original data. Accounts are kept. This cannot be undone.</p>
        <form action={resetAllContent} className="form">
          <label>
            Type RESET to confirm
            <input type="text" name="confirm" autoComplete="off" />
          </label>
          <div><button className="btn danger" type="submit">Reset content</button></div>
        </form>
      </div>
    </>
  );
}
