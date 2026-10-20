import Link from "next/link";
import { PasswordForm } from "@/components/AuthForm";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
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
                <Link href={`/tapes/${p.tape_id}`}>{p.title}</Link>
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
