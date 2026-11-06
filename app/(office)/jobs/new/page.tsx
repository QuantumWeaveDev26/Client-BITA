import { ErrorNote, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { Constants } from "@/lib/db/types";
import { prefillJobDefaultsFromQuotation } from "../../quotations/upload";
import { createJob } from "../actions";
import { JobForm } from "../job-form";
import { jobFormOptions } from "../options";

export const metadata = { title: "New job – BITA" };

// Opened from an accepted quotation (/jobs/new?quotation=<id>&enquiry=<id>&customer=<id>) or enquiry (/jobs/new?enquiry=<id>).
export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enquiry?: string; quotation?: string; customer?: string }>;
}) {
  const { error, enquiry: enquiryIdParam, quotation: quotationIdParam, customer: customerParam } = await searchParams;
  const { supabase } = await requireStaff();
  const options = await jobFormOptions(supabase);

  const quotationRes = quotationIdParam
    ? await supabase
        .from("quotations")
        .select("id, customer_id, enquiry_id, subject, quotation_items(description, basis, rate)")
        .eq("id", quotationIdParam)
        .maybeSingle()
    : null;

  const quotation = quotationRes?.data ?? null;
  const resolvedEnquiryId = enquiryIdParam ?? quotation?.enquiry_id ?? null;

  const enquiryRes = resolvedEnquiryId
    ? await supabase
        .from("enquiries")
        .select("id, customer_id, subject, extracted")
        .eq("id", resolvedEnquiryId)
        .maybeSingle()
    : null;

  const defaults = prefillJobDefaultsFromQuotation({
    quotation,
    enquiry: enquiryRes?.data ?? null,
    customerParam,
    validMethods: Constants.public.Enums.test_method,
  });

  return (
    <>
      <PageHeader title="New job" />
      <ErrorNote message={error} />
      <p className="mb-4 text-sm text-ink-2">The Job ID is given automatically when you save.</p>
      <JobForm action={createJob} defaults={defaults} submitLabel="Create job" {...options} />
    </>
  );
}
