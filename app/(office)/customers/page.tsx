import Link from "next/link";
import { Badge, ButtonLink, Input, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Customers – BITA" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase } = await requireStaff();

  let query = supabase.from("customers").select("id, name, code, gstin, uses_proforma, customer_contacts(count)").order("name");
  // Commas and brackets have a meaning in the filter syntax, so they are dropped from the search text.
  const term = q?.replace(/[,()%*]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%,gstin.ilike.%${term}%`);
  const { data: customers, error } = await query;

  return (
    <>
      <PageHeader title="Customers" action={<ButtonLink href="/customers/new">New customer</ButtonLink>} />
      <form className="mb-4">
        <Input name="q" placeholder="Search name, code or GSTIN" defaultValue={q} />
      </form>
      {error && <p className="text-sm text-ink">{error.message}</p>}
      <ul className="divide-y divide-line rounded-xl border border-line bg-white">
        {customers?.map((c) => (
          <li key={c.id}>
            <Link href={`/customers/${c.id}`} className="block px-4 py-3 hover:bg-side">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.name}</span>
                {c.code && <Badge>{c.code}</Badge>}
                {c.uses_proforma && <Badge>Proforma</Badge>}
              </div>
              <div className="mt-1 text-xs text-ink-3">
                {c.gstin ?? "GSTIN not given"} · {c.customer_contacts[0]?.count ?? 0} contacts
              </div>
            </Link>
          </li>
        ))}
        {customers?.length === 0 && <li className="px-4 py-6 text-sm text-ink-3">No customers found.</li>}
      </ul>
    </>
  );
}
