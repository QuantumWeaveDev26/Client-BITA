"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/(auth)/login/actions";
import { roleLabel } from "@/lib/roles";
import { Avatar } from "./ui";

// The sidebar layout for office screens. Each role gets its own menu (D-015).

type NavItem = { href: string; label: string; icon: keyof typeof ICONS; count?: number };
export type NavCounts = Partial<Record<"enquiries" | "quotations" | "jobs" | "reports", number>>;

const ICONS = {
  home: "M3 12l9-8 9 8M5 10v10h14V10",
  enquiries: "M4 4h16v12H5l-1 4z",
  quotations: "M6 3h9l4 4v14H6zM14 3v5h5",
  jobs: "M3 7h18v13H3zM8 7V4h8v3",
  reports: "M7 3h10v18l-5-3-5 3z",
  money: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9 10h4.5a2 2 0 010 4H9",
  customers: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 100-6M21 20c0-2-1-4-4-5",
  people: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6",
  equipment: "M4 7h16v10H4zM8 17v3M16 17v3",
  schedule: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  chart: "M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6",
} as const;

function menuFor(roles: readonly string[], c: NavCounts): { main: NavItem[]; records: NavItem[] } {
  const management = roles.includes("management");
  const office = roles.includes("office");
  const reviewer = roles.includes("reviewer");

  if (management) {
    return {
      main: [
        { href: "/dashboard", label: "Home", icon: "home" },
        { href: "/enquiries", label: "Enquiries", icon: "enquiries", count: c.enquiries },
        { href: "/quotations", label: "Quotations", icon: "quotations", count: c.quotations },
        { href: "/jobs", label: "Jobs", icon: "jobs", count: c.jobs },
        { href: "/review", label: "Reports", icon: "reports", count: c.reports },
      ],
      records: [
        { href: "/customers", label: "Customers", icon: "customers" },
        { href: "/registers", label: "People & equipment", icon: "people" },
      ],
    };
  }
  if (office) {
    return {
      main: [
        { href: "/office", label: "Home", icon: "home" },
        { href: "/enquiries", label: "Enquiries", icon: "enquiries", count: c.enquiries },
        { href: "/quotations", label: "Quotations", icon: "quotations" },
        { href: "/jobs", label: "Jobs", icon: "jobs", count: c.jobs },
        ...(reviewer ? [{ href: "/review", label: "Reports", icon: "reports" as const, count: c.reports }] : []),
      ],
      records: [
        { href: "/customers", label: "Customers", icon: "customers" },
        { href: "/registers", label: "People & equipment", icon: "people" },
      ],
    };
  }
  // Reviewer only.
  return {
    main: [
      { href: "/review", label: "Reports to review", icon: "reports", count: c.reports },
      { href: "/jobs", label: "Jobs", icon: "jobs" },
    ],
    records: [{ href: "/registers", label: "People & equipment", icon: "people" }],
  };
}

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 fill-none stroke-current" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13.5px] ${
        active ? "bg-white font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:bg-white hover:text-ink"
      }`}
    >
      <Icon name={item.icon} />
      {item.label}
      {!!item.count && <span className="ml-auto pl-2 font-mono text-[11.5px] text-ink-3">{item.count}</span>}
    </Link>
  );
}

export function AppShell({
  person,
  counts,
  children,
}: {
  person: { full_name: string; roles: string[] };
  counts: NavCounts;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { main, records } = menuFor(person.roles, counts);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen bg-white md:grid md:grid-cols-[232px_1fr]">
      {/* Phone: a top bar with the menu as a scrolling row. */}
      <div className="sticky top-0 z-10 border-b border-line bg-side md:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <Org subtitle={roleLabel(person.roles)} />
          <form action={signOut}>
            <button className="text-[13px] text-ink-2">Log out</button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
          {[...main, ...records].map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
      </div>

      {/* Desktop and tablet: the sidebar. */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-0.5 border-r border-line bg-side px-2.5 py-3.5 md:flex">
        <div className="px-2 pb-4">
          <Org subtitle={roleLabel(person.roles)} />
        </div>
        <nav className="flex flex-col gap-0.5">
          {main.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
          {records.length > 0 && <div className="px-2.5 pb-1.5 pt-4 text-[11.5px] text-ink-3">Records</div>}
          {records.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-line px-2 pt-3">
          <Avatar name={person.full_name} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium text-ink">{person.full_name}</div>
            <form action={signOut}>
              <button className="text-[12px] text-ink-3 hover:text-ink">Log out</button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 md:px-9 md:py-7">{children}</main>
    </div>
  );
}

function Org({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-ink text-[12px] font-bold tracking-[-0.02em] text-white">BI</span>
      <div className="leading-tight">
        <div className="text-[13.5px] font-semibold text-ink">BITA</div>
        <div className="text-[12px] text-ink-3">{subtitle}</div>
      </div>
    </div>
  );
}
