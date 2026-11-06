import Link from "next/link";
import { Badge, ButtonLink, Input, PageHeader, Select, Status } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { Constants, type Enums } from "@/lib/db/types";
import { isJobReadyToClose } from "./closure";
import { JOB_STATUS_LABEL, METHOD_LABEL } from "./labels";

export const metadata = { title: "Jobs – BITA" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const { supabase } = await requireStaff();

  let query = supabase
    .from("jobs")
    .select(
      "id, job_no, status, scope, site, test_methods, po_number, created_at, customers(name), reports(status, sent_at), invoices(kind, balance)"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status && (Constants.public.Enums.job_status as readonly string[]).includes(status))
    query = query.eq("status", status as Enums<"job_status">);
  // Commas and brackets have a meaning in the filter syntax, so they are dropped from the search text.
  const term = q?.replace(/[,()%*]/g, " ").trim();
  if (term) query = query.or(`job_no.ilike.%${term}%,po_number.ilike.%${term}%,scope.ilike.%${term}%`);
  const { data: jobs, error } = await query;

  return (
    <>
      <PageHeader title="Jobs" action={<ButtonLink href="/jobs/new">New job</ButtonLink>} />
      <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input name="q" placeholder="Search Job ID, PO number or scope" defaultValue={q} />
        <Select name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>
          {Constants.public.Enums.job_status.map((s) => (
            <option key={s} value={s}>
              {JOB_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <button className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-side">Filter</button>
      </form>
      {error && <p className="text-sm text-ink">{error.message}</p>}
      <ul className="divide-y divide-line rounded-xl border border-line bg-white">
        {jobs?.map((j) => {
          const readyToClose = isJobReadyToClose({
            status: j.status,
            reports: j.reports,
            invoices: j.invoices,
          });
          return (
            <li key={j.id}>
              <Link href={`/jobs/${j.id}`} className="block px-4 py-3 hover:bg-side">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{j.job_no}</span>
                  <Badge>{JOB_STATUS_LABEL[j.status]}</Badge>
                  {readyToClose && <Status tone="ok">Ready to close</Status>}
                  {j.test_methods.map((m) => (
                    <Badge key={m}>{METHOD_LABEL[m]}</Badge>
                  ))}
                </div>
                <div className="mt-1 text-sm">{j.customers?.name}</div>
                <div className="text-xs text-ink-3">
                  {[j.scope, j.site, j.po_number ? `PO ${j.po_number}` : "No PO yet"].filter(Boolean).join(" · ")}
                </div>
              </Link>
            </li>
          );
        })}
        {jobs?.length === 0 && <li className="px-4 py-6 text-sm text-ink-3">No jobs found.</li>}
      </ul>
    </>
  );
}
