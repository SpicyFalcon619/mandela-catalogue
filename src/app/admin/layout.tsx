import { requireAdmin } from "@/lib/auth";
import { ENTITIES } from "@/lib/entities";
import { sql } from "@/lib/db";
import { AdminNav } from "@/components/AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [waiting, reported] = await Promise.all([
    sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM comments WHERE status = 'pending'"),
    sql.get<{ n: number }>("SELECT COUNT(DISTINCT comment_id) AS n FROM comment_reports WHERE resolved = 0"),
  ]);
  const pending = (waiting?.n ?? 0) + (reported?.n ?? 0);
  const items = [
    { href: "/admin", label: "Overview" },
    ...ENTITIES.map((e) => ({ href: `/admin/${e.key}`, label: e.label })),
    { href: "/admin/settings", label: "Site settings" },
    { href: "/admin/moderation", label: pending ? `Moderation (${pending})` : "Moderation" },
    { href: "/admin/users", label: "Users" },
  ];
  return (
    <main className="admin">
      <AdminNav items={items} />
      <div>{children}</div>
    </main>
  );
}
