"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  sublabel?: string;
};

export function AppNav({
  items,
  className = "",
  compact = false
}: {
  items: NavItem[];
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className={className}>
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? compact
                  ? "whitespace-nowrap rounded-md border border-leaf/25 bg-leaf/10 px-3 py-2 font-medium text-mint"
                  : "rounded-md border border-leaf/25 bg-leaf/10 px-4 py-3 font-medium text-mint shadow-[inset_3px_0_0_rgba(99,245,215,0.85)]"
                : compact
                  ? "whitespace-nowrap rounded-md px-3 py-2 text-ink/70 transition hover:bg-white/10 hover:text-mint"
                  : "rounded-md px-4 py-3 text-ink/65 transition hover:bg-white/10 hover:text-ink"
            }
          >
            <span>{item.label}</span>
            {item.sublabel ? (
              <span className="ml-2 text-xs text-ink/40">{item.sublabel}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
