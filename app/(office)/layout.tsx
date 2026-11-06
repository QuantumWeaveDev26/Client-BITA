import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { signOut } from "../(auth)/login/actions";

// Menu for every stage 1 screen. Pages not built yet show the "not found" page.
const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/enquiries", label: "Enquiries" },
  { href: "/customers", label: "Customers" },
  { href: "/quotations", label: "Quotations" },
  { href: "/jobs", label: "Jobs" },
  { href: "/registers", label: "Registers" },
];

export default async function OfficeLayout({ children }: { children: ReactNode }) {
  const { person } = await requireUser();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-bold text-red-700">BITA</span>
          <nav className="flex gap-4 overflow-x-auto text-sm font-medium">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap hover:text-red-700">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={signOut}>
            <button className="text-sm text-neutral-600 hover:text-red-700">Log out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {person ? (
          children
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Your login works, but it is not set up as BITA staff yet. Ask Naveen to add you.
          </p>
        )}
      </main>
    </div>
  );
}
