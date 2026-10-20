import { requireAdmin } from "@/lib/auth";
import { updateUser } from "@/app/actions/admin";
import { getUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type U = { id: number; username: string; role: string; banned: number; created_at: string; posts: number };

export default async function Users() {
  await requireAdmin(); // pages check too: layouts are not re-run on client-side navigation
  const me = await getUser();
  const users = await sql.all<U>("SELECT u.id, u.username, u.role, u.banned, u.created_at, (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS posts FROM users u ORDER BY u.created_at DESC, u.id DESC");
  const btn = (u: U, action: string, label: string, danger = false) => (
    <form action={updateUser}>
      <input type="hidden" name="id" value={u.id} />
      <input type="hidden" name="action" value={action} />
      <button className={`btn sm${danger ? " danger" : ""}`} type="submit">{label}</button>
    </form>
  );
  return (
    <>
      <h1>Users</h1>
      <p className="intro">Make someone an admin, suspend a sign-in, or delete an account and its posts. You cannot change your own account here.</p>
      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Posts</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}{u.id === me?.id ? " (you)" : ""}</td>
                <td>{u.role}</td>
                <td><span className={`pill ${u.banned ? "off" : "on"}`}>{u.banned ? "suspended" : "active"}</span></td>
                <td>{u.posts}</td>
                <td>{u.created_at}</td>
                <td className="act">
                  {u.id !== me?.id && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {u.role === "admin" ? btn(u, "make_user", "Remove admin") : btn(u, "make_admin", "Make admin")}
                      {u.banned ? btn(u, "unban", "Reinstate") : btn(u, "ban", "Suspend")}
                      {btn(u, "delete", "Delete", true)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
