import Link from "next/link";
import { Card, EmptyRow, ErrorNote, List, ListRow, Mono, PageHeader, SectionTitle } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
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
  const { supabase } = await requireStaff();
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
    .select(
      "id, description, basis, rate, minimum_charge, quotations!inner(id, ref_no, quote_date, status, customer_id, customers(name))",
    )
    .order("position", { ascending: true })
    .limit(15);

  const sortedPastItems = (pastItems ?? []).sort((a, b) => {
    const aMatch = targetCustomerId && a.quotations.customer_id === targetCustomerId ? 0 : 1;
    const bMatch = targetCustomerId && b.quotations.customer_id === targetCustomerId ? 0 : 1;
    return aMatch - bMatch;
  });

  return (
    <>
      <PageHeader
        title="New quotation"
        subtitle="BITA has no fixed rate list (R9) and quotations have no expiry date (R11). Management approves before sending (R10)."
      />
      <ErrorNote message={error} />

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <QuotationForm
            action={createQuotation}
            defaults={defaults}
            includeFirstItem
            submitLabel="Create quotation"
            {...options}
          />
        </Card>

        <div>
          <SectionTitle>Past quoted rates (R9)</SectionTitle>
          <List>
            {sortedPastItems.length > 0 ? (
              sortedPastItems.map((it) => (
                <ListRow
                  key={it.id}
                  title={it.description}
                  detail={
                    <>
                      <Link href={`/quotations/${it.quotations.id}`} className="underline">
                        <Mono>{it.quotations.ref_no ?? "Draft"}</Mono>
                      </Link>
                      {" · "}
                      {it.quotations.customers?.name}
                      {" · "}
                      {formatDateIN(it.quotations.quote_date)} ({QUOTATION_STATUS_LABEL[it.quotations.status]})
                    </>
                  }
                  action={
                    <div className="text-right">
                      <Mono>{formatINR(it.rate)}</Mono>
                      {it.basis ? <span className="ml-1 text-xs text-ink-3">{it.basis}</span> : null}
                      {it.minimum_charge ? (
                        <div className="text-xs text-ink-3">min {formatINR(it.minimum_charge)}</div>
                      ) : null}
                    </div>
                  }
                />
              ))
            ) : (
              <EmptyRow>No past quotation items recorded yet.</EmptyRow>
            )}
          </List>
        </div>
      </div>
    </>
  );
}
