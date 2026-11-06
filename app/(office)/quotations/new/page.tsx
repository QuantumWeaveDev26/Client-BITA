import Link from "next/link";
import { Card, ErrorNote, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatINR } from "../../jobs/labels";
import { createQuotation } from "../actions";
import { formatDateIN, QUOTATION_STATUS_LABEL } from "../labels";
import { quotationFormOptions } from "../options";
import { QuotationForm } from "../quotation-form";

export const metadata = { title: "New quotation – BITA" };

// Opened from an enquiry as /quotations/new?enquiry=<id> or customer as /quotations/new?customer=<id>.
export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enquiry?: string; customer?: string }>;
}) {
  const { error, enquiry: enquiryId, customer: customerIdParam } = await searchParams;
  const { supabase } = await requireUser();
  const options = await quotationFormOptions(supabase);

  let defaults: { customer_id?: string; enquiry_id?: string; subject?: string; attention?: string } | undefined;
  if (enquiryId) {
    const { data: enquiry } = await supabase
      .from("enquiries")
      .select("id, customer_id, subject, from_name")
      .eq("id", enquiryId)
      .maybeSingle();
    if (enquiry) {
      defaults = {
        enquiry_id: enquiry.id,
        customer_id: enquiry.customer_id ?? customerIdParam ?? undefined,
        subject: enquiry.subject ?? undefined,
        attention: enquiry.from_name ?? undefined,
      };
    }
  } else if (customerIdParam) {
    defaults = { customer_id: customerIdParam };
  }

  const targetCustomerId = defaults?.customer_id;
  const { data: pastItems } = await supabase
    .from("quotation_items")
    .select("id, description, basis, rate, minimum_charge, quotations!inner(id, ref_no, quote_date, status, customer_id, customers(name))")
    .order("position", { ascending: true })
    .limit(15);

  const sortedPastItems = (pastItems ?? []).sort((a, b) => {
    const aMatch = targetCustomerId && a.quotations.customer_id === targetCustomerId ? 0 : 1;
    const bMatch = targetCustomerId && b.quotations.customer_id === targetCustomerId ? 0 : 1;
    return aMatch - bMatch;
  });

  return (
    <>
      <PageHeader title="New quotation" />
      <ErrorNote message={error} />
      <p className="mb-4 text-sm text-neutral-600">
        BITA has no fixed rate list (R9) and quotations have no expiry date (R11). Enter prices for this customer and scope; management approves before sending (R10).
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <QuotationForm
            action={createQuotation}
            defaults={defaults}
            includeFirstItem
            submitLabel="Create quotation"
            {...options}
          />
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold">Past quoted rates (R9)</h2>
          <p className="mb-3 text-xs text-neutral-500">
            Reference rates from previous quotations. If an approved quotation already covers repeat work, reuse that quotation on the job (R13).
          </p>
          {sortedPastItems.length > 0 ? (
            <ul className="divide-y divide-neutral-100 text-xs">
              {sortedPastItems.map((it) => (
                <li key={it.id} className="py-2">
                  <div className="font-medium text-neutral-800">{it.description}</div>
                  <div className="mt-0.5 font-mono font-semibold text-neutral-900">
                    {formatINR(it.rate)} {it.basis ?? ""}
                    {it.minimum_charge ? ` · min ${formatINR(it.minimum_charge)}` : ""}
                  </div>
                  <div className="text-neutral-500">
                    <Link href={`/quotations/${it.quotations.id}`} className="text-red-700 underline">
                      {it.quotations.ref_no ?? "Draft"}
                    </Link>
                    {" · "}
                    {it.quotations.customers?.name}
                    {" · "}
                    {formatDateIN(it.quotations.quote_date)} ({QUOTATION_STATUS_LABEL[it.quotations.status]})
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-neutral-500">No past quotation items recorded yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
