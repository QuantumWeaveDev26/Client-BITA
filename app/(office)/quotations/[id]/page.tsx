import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  SecondaryButton,
  Select,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { Constants } from "@/lib/db/types";
import { formatIST } from "../../enquiries/labels";
import { formatINR } from "../../jobs/labels";
import {
  addQuotationItem,
  approveQuotation,
  deleteQuotationItem,
  reviseQuotation,
  setQuotationStatus,
  updateQuotation,
  updateQuotationItem,
} from "../actions";
import { formatDateIN, QUOTATION_STATUS_LABEL } from "../labels";
import { quotationFormOptions } from "../options";
import { QuotationForm } from "../quotation-form";

export default async function QuotationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; rate_q?: string }>;
}) {
  const { id } = await params;
  const { error, saved, rate_q } = await searchParams;
  const { supabase, person } = await requireUser();

  const { data: quotation } = await supabase.from("quotations").select("*").eq("id", id).maybeSingle();
  if (!quotation) notFound();

  const rateTerm = rate_q?.replace(/[,()%*]/g, " ").trim();
  let pastRatesQuery = supabase
    .from("quotation_items")
    .select("id, description, basis, rate, minimum_charge, quotations!inner(id, ref_no, quote_date, status, customers(name))")
    .neq("quotation_id", id)
    .order("position", { ascending: true })
    .limit(15);
  if (rateTerm) {
    pastRatesQuery = pastRatesQuery.or(`description.ilike.%${rateTerm}%,basis.ilike.%${rateTerm}%`);
  }

  const [customer, enquiry, items, approver, supersededBy, linkedJobs, pastRates, options] = await Promise.all([
    supabase.from("customers").select("*").eq("id", quotation.customer_id).maybeSingle(),
    quotation.enquiry_id
      ? supabase.from("enquiries").select("id, subject, source, received_at").eq("id", quotation.enquiry_id).maybeSingle()
      : null,
    supabase.from("quotation_items").select("*").eq("quotation_id", id).order("position").order("id"),
    quotation.approved_by
      ? supabase.from("people").select("id, full_name, position").eq("id", quotation.approved_by).maybeSingle()
      : null,
    quotation.superseded_by
      ? supabase.from("quotations").select("id, ref_no, status").eq("id", quotation.superseded_by).maybeSingle()
      : null,
    supabase.from("jobs").select("id, job_no, status, scope").eq("quotation_id", id).order("created_at", { ascending: false }),
    pastRatesQuery,
    quotationFormOptions(supabase),
  ]);

  const pdfUrl = quotation.pdf_path
    ? (await supabase.storage.from("documents").createSignedUrl(quotation.pdf_path, 600)).data?.signedUrl
    : null;

  const isManagement = Boolean(person?.roles.includes("management"));
  const nextPosition = (items.data?.length ?? 0) + 1;

  return (
    <>
      <PageHeader
        title={quotation.ref_no ? `Quotation ${quotation.ref_no}` : "Draft quotation"}
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/quotations/${id}/print`}>Letterhead / PDF</ButtonLink>
            <Link
              href={`/jobs/new?customer=${quotation.customer_id}${quotation.enquiry_id ? `&enquiry=${quotation.enquiry_id}` : ""}`}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-100"
            >
              Create job
            </Link>
          </div>
        }
      />

      <ErrorNote message={error} />
      {saved && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {saved === "approved"
            ? "Quotation approved by management."
            : saved === "revised"
              ? "New quotation revision created from the earlier quotation."
              : "Saved."}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge>{QUOTATION_STATUS_LABEL[quotation.status]}</Badge>
        <span className="text-xs text-neutral-500">Date: {formatDateIN(quotation.quote_date)}</span>
        <span className="text-xs text-neutral-500">· No fixed expiry (R11)</span>
        {approver?.data && quotation.approved_at && (
          <span className="text-xs text-green-800">
            · Approved by {approver.data.full_name} ({formatIST(quotation.approved_at)})
          </span>
        )}
      </div>

      {supersededBy?.data && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This quotation was superseded by{" "}
          <Link href={`/quotations/${supersededBy.data.id}`} className="font-semibold text-red-700 underline">
            {supersededBy.data.ref_no ?? "revised draft"}
          </Link>
          .
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-2 font-semibold">Customer &amp; enquiry</h2>
            {customer.data && (
              <div className="text-sm">
                <Link href={`/customers/${customer.data.id}`} className="font-medium text-red-700 underline">
                  {customer.data.name}
                </Link>
                {customer.data.billing_address && (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-600">{customer.data.billing_address}</p>
                )}
                <p className="mt-1 text-xs text-neutral-500">
                  {[
                    customer.data.gstin ? `GSTIN ${customer.data.gstin}` : null,
                    quotation.attention ? `Attn: ${quotation.attention}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            )}
            <div className="mt-3 text-sm">
              <span className="text-neutral-500">Enquiry: </span>
              {enquiry?.data ? (
                <Link href={`/enquiries/${enquiry.data.id}`} className="text-red-700 underline">
                  {enquiry.data.subject ?? "(no subject)"}
                </Link>
              ) : (
                "None"
              )}
            </div>
            {pdfUrl && (
              <div className="mt-2 text-sm">
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-red-700 underline">
                  Open uploaded PDF file
                </a>
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">Priced items (R9)</h2>
              <span className="text-xs text-neutral-500">{items.data?.length ?? 0} item(s)</span>
            </div>

            <ul className="space-y-4">
              {items.data?.map((it) => (
                <li key={it.id} className="border-b border-neutral-100 pb-4 last:border-0">
                  <details>
                    <summary className="cursor-pointer">
                      <span className="font-mono text-xs text-neutral-500">#{it.position}</span>{" "}
                      <span className="font-medium text-sm">{it.description}</span>
                      <div className="mt-0.5 text-xs text-neutral-700">
                        <span className="font-mono font-semibold">{formatINR(it.rate)}</span>{" "}
                        {it.basis ? <span>({it.basis})</span> : null}
                        {it.minimum_charge ? ` · Minimum charge: ${formatINR(it.minimum_charge)}` : ""}
                        {it.notes ? ` · ${it.notes}` : ""}
                      </div>
                    </summary>
                    <form action={updateQuotationItem.bind(null, id, it.id)} className="mt-3 space-y-3">
                      <ItemFields item={it} />
                      <div className="flex gap-2">
                        <Button type="submit">Save item</Button>
                        <SecondaryButton formAction={deleteQuotationItem.bind(null, id, it.id)}>Remove</SecondaryButton>
                      </div>
                    </form>
                  </details>
                </li>
              ))}
              {items.data?.length === 0 && (
                <li className="text-sm text-neutral-500">No items added yet. Add the component and inspection rates below.</li>
              )}
            </ul>

            <details className="mt-4" open={(items.data?.length ?? 0) === 0}>
              <summary className="cursor-pointer text-sm font-semibold text-red-700">Add a priced item</summary>
              <form action={addQuotationItem.bind(null, id)} className="mt-3 space-y-3">
                <ItemFields defaultPosition={nextPosition} />
                <Button type="submit">Add item</Button>
              </form>
            </details>
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Management approval &amp; revisions (R10, R11)</h2>
            <p className="mb-3 text-xs text-neutral-600">
              Only Anand Teertha or S. Radhakrishnan (management) can approve and send a quotation (R10). Quotations have no expiry date; management decides when to issue a revised quotation (R11).
            </p>

            {isManagement ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {quotation.status === "draft" && (
                    <form action={approveQuotation.bind(null, id)}>
                      <Button type="submit">Approve quotation</Button>
                    </form>
                  )}
                  <form action={reviseQuotation.bind(null, id)}>
                    <SecondaryButton type="submit">Create revised quotation (R11)</SecondaryButton>
                  </form>
                </div>

                <form action={setQuotationStatus.bind(null, id)} className="flex flex-wrap items-center gap-2 pt-2">
                  <Select name="status" defaultValue={quotation.status}>
                    {Constants.public.Enums.quotation_status.map((s) => (
                      <option key={s} value={s}>
                        {QUOTATION_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                  <SecondaryButton type="submit">Update status</SecondaryButton>
                </form>
              </div>
            ) : (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Your account does not have the management role, so you can draft items but cannot approve this quotation.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Jobs covered by this quotation (R13)</h2>
            <p className="mb-2 text-xs text-neutral-500">
              Repeat work on the same component and scope reuses an approved quotation.
            </p>
            <ul className="space-y-1 text-sm">
              {linkedJobs.data?.map((j) => (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="font-mono font-medium text-red-700 underline">
                    {j.job_no}
                  </Link>{" "}
                  <span className="text-xs text-neutral-600">
                    ({j.status}) {j.scope ? `· ${j.scope}` : ""}
                  </span>
                </li>
              ))}
              {linkedJobs.data?.length === 0 && <li className="text-neutral-500">No jobs linked to this quotation yet.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold">Edit quotation details</h2>
            <QuotationForm
              action={updateQuotation.bind(null, id)}
              quotation={quotation}
              submitLabel="Save changes"
              {...options}
            />
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Search past rates (R9)</h2>
            <form className="mb-3 flex gap-2">
              <Input name="rate_q" placeholder="Component, method or basis…" defaultValue={rate_q} />
              <SecondaryButton type="submit">Search</SecondaryButton>
            </form>
            <ul className="divide-y divide-neutral-100 text-xs">
              {pastRates.data?.map((it) => (
                <li key={it.id} className="py-2 flex items-baseline justify-between gap-2">
                  <div>
                    <div className="font-medium text-neutral-800">{it.description}</div>
                    <div className="text-neutral-500">
                      <Link href={`/quotations/${it.quotations.id}`} className="text-red-700 underline">
                        {it.quotations.ref_no ?? "Draft"}
                      </Link>
                      {" · "}
                      {it.quotations.customers?.name} · {formatDateIN(it.quotations.quote_date)}
                    </div>
                  </div>
                  <div className="text-right font-mono font-semibold text-neutral-900">
                    {formatINR(it.rate)} {it.basis ?? ""}
                    {it.minimum_charge ? <div className="font-sans font-normal text-neutral-500">Min {formatINR(it.minimum_charge)}</div> : null}
                  </div>
                </li>
              ))}
              {pastRates.data?.length === 0 && <li className="py-2 text-neutral-500">No matching past items found.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function ItemFields({
  item,
  defaultPosition = 1,
}: {
  item?: {
    position: number;
    description: string;
    basis: string | null;
    rate: number | null;
    minimum_charge: number | null;
    notes: string | null;
  };
  defaultPosition?: number;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
        <Field label="Sl. No.">
          <Input name="position" type="number" min="1" required defaultValue={item?.position ?? defaultPosition} />
        </Field>
        <Field label="Component / inspection description">
          <Input name="description" required placeholder="Ultrasonic testing of forged shafts" defaultValue={item?.description ?? ""} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Rate (INR)">
          <Input name="rate" type="number" step="0.01" min="0" defaultValue={item?.rate ?? ""} />
        </Field>
        <Field label="Basis" hint="e.g. per shaft, per ring, per visit">
          <Input name="basis" placeholder="per shaft" defaultValue={item?.basis ?? ""} />
        </Field>
        <Field label="Minimum charge (INR)">
          <Input name="minimum_charge" type="number" step="0.01" min="0" defaultValue={item?.minimum_charge ?? ""} />
        </Field>
      </div>
      <Field label="Notes">
        <Input name="notes" placeholder="Optional item note or conveyance detail" defaultValue={item?.notes ?? ""} />
      </Field>
    </>
  );
}
