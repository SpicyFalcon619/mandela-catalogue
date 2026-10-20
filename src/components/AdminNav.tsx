"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="anav" aria-label="Admin">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={path === i.href || (i.href !== "/admin" && path.startsWith(i.href + "/")) ? "on" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
