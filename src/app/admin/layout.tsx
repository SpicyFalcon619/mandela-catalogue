import { requireAdmin } from "@/lib/auth";
import { ENTITIES } from "@/lib/entities";
import { sql } from "@/lib/db";
import { AdminNav } from "@/components/AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const pending = (await sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM comments WHERE status = 'pending'"))?.n ?? 0;
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
