import Link from "next/link";
import { Badge, ButtonLink, Card, Input, PageHeader, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { Constants, type Enums } from "@/lib/db/types";
import { formatINR } from "../jobs/labels";
import { formatDateIN, QUOTATION_STATUS_LABEL } from "./labels";

export const metadata = { title: "Quotations – BITA" };

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; rate?: string }>;
}) {
  const { q, status, rate } = await searchParams;
  const { supabase } = await requireUser();

  let query = supabase
    .from("quotations")
    .select(
      "id, ref_no, quote_date, subject, attention, status, approved_at, customers(name), quotation_items(id, description, basis, rate, minimum_charge)",
    )
    .order("quote_date", { ascending: false })
    .limit(100);

  if (status && (Constants.public.Enums.quotation_status as readonly string[]).includes(status)) {
    query = query.eq("status", status as Enums<"quotation_status">);
  }

  // Commas and brackets have a meaning in the filter syntax, so they are dropped from the search text.
  const term = q?.replace(/[,()%*]/g, " ").trim();
  if (term) {
    query = query.or(`ref_no.ilike.%${term}%,subject.ilike.%${term}%,attention.ilike.%${term}%`);
  }

  // R9: Previous quotations and their rates must be searchable for reference.
  const rateTerm = (rate ?? q)?.replace(/[,()%*]/g, " ").trim();
  let itemQuery = supabase
    .from("quotation_items")
    .select(
      "id, description, basis, rate, minimum_charge, notes, quotations!inner(id, ref_no, quote_date, status, customers(name))",
    )
    .order("position", { ascending: true })
    .limit(40);
  if (rateTerm) {
    itemQuery = itemQuery.or(`description.ilike.%${rateTerm}%,basis.ilike.%${rateTerm}%,notes.ilike.%${rateTerm}%`);
  }

  const [{ data: quotations, error }, { data: pastItems }] = await Promise.all([query, itemQuery]);

  return (
    <>
      <PageHeader title="Quotations" action={<ButtonLink href="/quotations/new">New quotation</ButtonLink>} />

      <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <Input name="q" placeholder="Search Ref. No., subject or attention" defaultValue={q} />
        <Input name="rate" placeholder="Search past item rates (component, method, basis)" defaultValue={rate} />
        <Select name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>
          {Constants.public.Enums.quotation_status.map((s) => (
            <option key={s} value={s}>
              {QUOTATION_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <button className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100">
          Filter
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-700">{error.message}</p>}

      {(rateTerm || (pastItems && pastItems.length > 0)) && (
        <div className="mb-6">
          <Card>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {rateTerm ? `Past rates matching "${rateTerm}"` : "Recent quoted rates (R9 reference)"}
              </h2>
              <span className="text-xs text-neutral-500">No fixed rate list – rates are set per quotation</span>
            </div>
            {pastItems && pastItems.length > 0 ? (
              <ul className="divide-y divide-neutral-100 text-sm">
                {pastItems.map((it) => (
                  <li key={it.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <div>
                      <span className="font-medium">{it.description}</span>
                      {it.notes && <span className="ml-2 text-xs text-neutral-500">({it.notes})</span>}
                      <div className="text-xs text-neutral-500">
                        <Link href={`/quotations/${it.quotations.id}`} className="font-medium text-red-700 underline">
                          {it.quotations.ref_no ?? "Draft"}
                        </Link>
                        {" · "}
                        {it.quotations.customers?.name ?? "Customer"}
                        {" · "}
                        {formatDateIN(it.quotations.quote_date)}
                        {" · "}
                        {QUOTATION_STATUS_LABEL[it.quotations.status]}
                      </div>
                    </div>
                    <div className="text-right font-mono text-sm font-semibold text-neutral-900">
                      {formatINR(it.rate)} {it.basis ? <span className="font-sans text-xs font-normal text-neutral-600">{it.basis}</span> : null}
                      {it.minimum_charge ? (
                        <div className="font-sans text-xs font-normal text-neutral-500">
                          Min. {formatINR(it.minimum_charge)}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">No past quoted items matched this search.</p>
            )}
          </Card>
        </div>
      )}

      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {quotations?.map((qt) => (
          <li key={qt.id}>
            <Link href={`/quotations/${qt.id}`} className="block px-4 py-3 hover:bg-neutral-50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{qt.ref_no ?? "Draft"}</span>
                <Badge>{QUOTATION_STATUS_LABEL[qt.status]}</Badge>
                <span className="text-xs text-neutral-500">{formatDateIN(qt.quote_date)}</span>
              </div>
              <div className="mt-1 text-sm font-medium">{qt.customers?.name}</div>
              <div className="text-xs text-neutral-600">
                {[qt.subject, qt.attention ? `Attn: ${qt.attention}` : null, `${qt.quotation_items.length} item(s)`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {qt.quotation_items.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                  {qt.quotation_items.slice(0, 3).map((it) => (
                    <span key={it.id}>
                      {it.description}: <strong className="text-neutral-700">{formatINR(it.rate)}</strong>{" "}
                      {it.basis ?? ""}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </li>
        ))}
        {quotations?.length === 0 && <li className="px-4 py-6 text-sm text-neutral-500">No quotations found.</li>}
      </ul>
    </>
  );
}
