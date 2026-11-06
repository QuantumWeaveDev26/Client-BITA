import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, ErrorNote, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { formatIST } from "../../enquiries/labels";
import { updateJob } from "../actions";
import { JobForm } from "../job-form";
import { formatINR, JOB_STATUS_LABEL, METHOD_LABEL } from "../labels";
import { jobFormOptions } from "../options";

// R18: one page shows everything for a Job ID.
export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const { supabase } = await requireStaff();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();

  const [customer, contacts, enquiry, quotation, assignments, inspections, reports, attachments, invoices, options] = await Promise.all([
    supabase.from("customers").select("*").eq("id", job.customer_id).maybeSingle(),
    supabase.from("customer_contacts").select("name, mobile, email, receives_reports, receives_invoices").eq("customer_id", job.customer_id),
    job.enquiry_id ? supabase.from("enquiries").select("id, subject, source, received_at").eq("id", job.enquiry_id).maybeSingle() : null,
    job.quotation_id
      ? supabase.from("quotations").select("id, ref_no, status, quote_date, quotation_items(description, basis, rate, minimum_charge)").eq("id", job.quotation_id).maybeSingle()
      : null,
    supabase.from("assignments").select("id, work_date, acknowledged_at, completed_at, people(full_name)").eq("job_id", id).order("work_date"),
    supabase.from("inspections").select("id, method, submitted_at, missing_fields").eq("job_id", id),
    supabase.from("reports").select("id, report_no, method, status, approved_at, sent_at").eq("job_id", id).order("report_no"),
    supabase.from("attachments").select("id, kind, caption, storage_path").eq("job_id", id).order("uploaded_at"),
    supabase.from("invoices").select("id, kind, number, invoice_date, due_date, total, balance, status").eq("job_id", id).order("invoice_date"),
    jobFormOptions(supabase),
  ]);

  const poUrl = job.po_path
    ? (await supabase.storage.from("documents").createSignedUrl(job.po_path, 600)).data?.signedUrl
    : null;
  // Outstanding is the sum of the balances Zoho Books reports; nothing is calculated here.
  const outstanding = (invoices.data ?? []).reduce((sum, i) => sum + (i.balance ?? 0), 0);

  return (
    <>
      <PageHeader title={job.job_no} />
      <ErrorNote message={error} />
      {saved && <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Saved.</p>}
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge>{JOB_STATUS_LABEL[job.status]}</Badge>
        {job.test_methods.map((m) => (
          <Badge key={m}>{METHOD_LABEL[m]}</Badge>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-2 font-semibold">Customer</h2>
            {customer.data && (
              <>
                <Link href={`/customers/${customer.data.id}`} className="font-medium text-red-700 underline">
                  {customer.data.name}
                </Link>
                <p className="mt-1 text-sm text-neutral-600">
                  {[customer.data.gstin, customer.data.uses_proforma ? "Proforma first" : null, `${customer.data.payment_terms_days} days`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {contacts.data?.map((c) => (
                    <li key={c.name}>
                      {c.name}
                      <span className="text-xs text-neutral-500">
                        {" "}
                        {[c.mobile, c.email].filter(Boolean).join(" · ")}
                        {c.receives_reports ? " · reports" : ""}
                        {c.receives_invoices ? " · invoices" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Enquiry, quotation and PO</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-neutral-500">Enquiry</dt>
                <dd>
                  {enquiry?.data ? (
                    <Link href={`/enquiries/${enquiry.data.id}`} className="text-red-700 underline">
                      {enquiry.data.subject ?? "(no subject)"}
                    </Link>
                  ) : (
                    "None"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Quotation</dt>
                <dd>
                  {quotation?.data ? (
                    <>
                      {quotation.data.ref_no ?? "Draft"} ({quotation.data.status})
                      <ul className="mt-1 list-disc pl-5 text-xs text-neutral-600">
                        {quotation.data.quotation_items.map((it, n) => (
                          <li key={n}>
                            {it.description}: {formatINR(it.rate)} {it.basis ?? ""}
                            {it.minimum_charge ? `, minimum ${formatINR(it.minimum_charge)}` : ""}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    "None yet"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">PO</dt>
                <dd>
                  {job.po_number ?? "Not received yet"}
                  {job.po_date && ` · ${job.po_date}`}
                  {poUrl && (
                    <>
                      {" · "}
                      <a href={poUrl} target="_blank" rel="noreferrer" className="text-red-700 underline">
                        Open PO file
                      </a>
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Technicians and inspections</h2>
            <ul className="space-y-1 text-sm">
              {assignments.data?.map((a) => (
                <li key={a.id}>
                  {a.work_date}: {a.people?.full_name}
                  <span className="text-xs text-neutral-500">
                    {a.completed_at ? " · completed" : a.acknowledged_at ? " · acknowledged" : " · not acknowledged"}
                  </span>
                </li>
              ))}
              {assignments.data?.length === 0 && <li className="text-neutral-500">No technician assigned yet.</li>}
            </ul>
            <ul className="mt-3 space-y-1 text-sm">
              {inspections.data?.map((i) => (
                <li key={i.id}>
                  {METHOD_LABEL[i.method]} field data:{" "}
                  {i.submitted_at ? `submitted ${formatIST(i.submitted_at)}` : "not submitted"}
                  {i.missing_fields.length > 0 && (
                    <span className="text-red-700"> · missing {i.missing_fields.join(", ")}</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Reports</h2>
            <ul className="space-y-1 text-sm">
              {reports.data?.map((r) => (
                <li key={r.id}>
                  {r.report_no} · {METHOD_LABEL[r.method]} · {r.status}
                  {r.sent_at && <span className="text-xs text-neutral-500"> · sent {formatIST(r.sent_at)}</span>}
                </li>
              ))}
              {reports.data?.length === 0 && <li className="text-neutral-500">No reports yet.</li>}
            </ul>
            {attachments.data && attachments.data.length > 0 && (
              <>
                <h3 className="mt-3 text-sm font-semibold">Drawings and documents</h3>
                <ul className="space-y-1 text-sm">
                  {attachments.data.map((a) => (
                    <li key={a.id}>
                      {a.caption ?? a.storage_path.split("/").pop()} <span className="text-xs text-neutral-500">({a.kind})</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Invoices and payments</h2>
            <p className="mb-2 text-xs text-neutral-500">From Zoho Books.</p>
            <ul className="space-y-1 text-sm">
              {invoices.data?.map((i) => (
                <li key={i.id}>
                  {i.kind === "proforma" ? "Proforma" : "GST invoice"} {i.number ?? ""} · {formatINR(i.total)} · balance{" "}
                  {formatINR(i.balance)} · {i.status ?? ""}
                </li>
              ))}
              {invoices.data?.length === 0 && <li className="text-neutral-500">No invoices yet.</li>}
            </ul>
            {invoices.data && invoices.data.length > 0 && (
              <p className="mt-2 text-sm font-semibold">Outstanding: {formatINR(outstanding)}</p>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 font-semibold">Edit job</h2>
          <JobForm action={updateJob.bind(null, id)} job={job} submitLabel="Save changes" {...options} />
        </Card>
      </div>
    </>
  );
}
