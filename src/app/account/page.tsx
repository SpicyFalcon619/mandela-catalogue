import Link from "next/link";
import { PasswordForm } from "@/components/AuthForm";
import { MarkRepliesRead } from "@/components/MarkRepliesRead";
import { getRepliesTo } from "@/lib/comments";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const replies = await getRepliesTo(user.id);
  const unread = replies.filter((r) => r.unread).length;
  const posts = await sql.all<{ id: number; kind: string; body: string; status: string; created_at: string; tape_id: number; title: string }>(
    "SELECT c.id, c.kind, c.body, c.status, c.created_at, c.tape_id, t.title FROM comments c JOIN tapes t ON t.id = c.tape_id WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 50",
    user.id,
  );
  return (
    <main>
      <div className="crumbs"><Link href="/">← Home</Link></div>
      <div className="account-grid">
        <div>
          <h1 style={{ fontSize: "3.4rem", marginBottom: 6 }}>{user.username}</h1>
          <p className="mute">Role: {user.role}. Display settings are under Display in the top bar and save to this account.</p>
        </div>
        <div id="replies">
          <h2 style={{ fontSize: "2rem", textShadow: "none", marginBottom: 12 }}>Replies to you{unread > 0 ? ` (${unread} new)` : ""}</h2>
          {replies.length === 0 && <p className="mute">No replies yet. When someone answers one of your comments it shows up here.</p>}
          {unread > 0 && <p style={{ marginBottom: 12 }}><MarkRepliesRead /></p>}
          {replies.map((r) => (
            <div key={r.id} className={`cm reply${r.unread ? " new" : ""}`}>
              <div className="meta">
                <span className="cmt-user">{r.username}</span>
                <span>replied on</span>
                <Link href={`/tapes/${r.tape_id}#c${r.id}`}>{r.tape_title}</Link>
                <span>{r.created_at} UTC</span>
                {r.unread ? <span className="pill on">new</span> : null}
              </div>
              <p className="mute quote">{r.parent_body.length > 90 ? `${r.parent_body.slice(0, 90)}…` : r.parent_body}</p>
              <p>{r.body}</p>
            </div>
          ))}
        </div>
        <div>
          <h2 style={{ fontSize: "2rem", textShadow: "none", marginBottom: 12 }}>Change password</h2>
          <PasswordForm />
        </div>
        <div>
          <h2 style={{ fontSize: "2rem", textShadow: "none", marginBottom: 12 }}>Your posts</h2>
          {posts.length === 0 && <p className="mute">Nothing yet. Open a tape page to post.</p>}
          {posts.map((p) => (
            <div key={p.id} className={`cm${p.status === "pending" ? " pending" : ""}`}>
              <div className="meta">
                <span className="kind">{p.kind}</span>
                <Link href={`/tapes/${p.tape_id}#c${p.id}`}>{p.title}</Link>
                <span>{p.created_at}</span>
                {p.status !== "visible" && <span className="pill">{p.status}</span>}
              </div>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
