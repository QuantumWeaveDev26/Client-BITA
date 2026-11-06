import { ErrorNote, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createJob } from "../actions";
import { JobForm } from "../job-form";
import { jobFormOptions } from "../options";

export const metadata = { title: "New job – BITA" };

// Opened from an enquiry as /jobs/new?enquiry=<id>, the customer and scope are filled in.
export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ error?: string; enquiry?: string }> }) {
  const { error, enquiry: enquiryId } = await searchParams;
  const { supabase } = await requireUser();
  const options = await jobFormOptions(supabase);

  let defaults: { customer_id?: string; enquiry_id?: string; scope?: string } | undefined;
  if (enquiryId) {
    const { data: enquiry } = await supabase.from("enquiries").select("id, customer_id, subject").eq("id", enquiryId).maybeSingle();
    if (enquiry) defaults = { enquiry_id: enquiry.id, customer_id: enquiry.customer_id ?? undefined, scope: enquiry.subject ?? undefined };
  }

  return (
    <>
      <PageHeader title="New job" />
      <ErrorNote message={error} />
      <p className="mb-4 text-sm text-neutral-600">The Job ID is given automatically when you save.</p>
      <JobForm action={createJob} defaults={defaults} submitLabel="Create job" {...options} />
    </>
  );
}
