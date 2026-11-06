import { redirect } from "next/navigation";
import { Button, ButtonLink, Card, EmptyRow, ErrorNote, Field, Input, List, ListRow, Mono, PageHeader, SectionTitle, Select } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { daysBetween, todayIST } from "@/lib/dates";
import { homeFor } from "@/lib/roles";
import { METHOD_LABEL } from "../jobs/labels";
import { prepareReport } from "./actions";

export const metadata = { title: "Reports to review – BITA" };

// Reviewer home: the report queue (R26). Signatures and seal are added only after approval (R27).
export default async function ReviewQueue({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: actionError } = await searchParams;
  const { supabase, person } = await requireStaff();
  if (!person?.roles.some((r) => r === "reviewer" || r === "management")) redirect(homeFor(person?.roles));

  const [queue, drafts, recent, inspections, signatories] = await Promise.all([
    supabase
      .from("reports")
      .select("id, report_no, method, created_at, jobs(id, job_no, customers(name)), inspections(missing_fields, submitted_at)")
      .eq("status", "in_review")
      .order("created_at"),
    supabase
      .from("reports")
      .select("id, report_no, method, jobs(id, job_no, customers(name)), inspections(missing_fields, submitted_at)")
      .in("status", ["draft", "returned"])
      .order("created_at"),
    supabase
      .from("reports")
      .select("id, report_no, method, approved_at, jobs(id, customers(name))")
      .in("status", ["approved", "sent"])
      .order("approved_at", { ascending: false })
      .limit(5),
    supabase.from("inspections").select("id, method, submitted_at, missing_fields, jobs(job_no, customers(name))")
      .not("submitted_at", "is", null).in("method", ["UT", "MPT", "DPT"]).order("submitted_at", { ascending: false }).limit(100),
    supabase.from("people").select("id, full_name").eq("active", true).overlaps("roles", ["reviewer", "management"]).order("full_name"),
  ]);

  const today = todayIST();
  const waiting = queue.data ?? [];
  const oldest = waiting[0] ? daysBetween(waiting[0].created_at.slice(0, 10), today) : 0;

  return (
    <>
      <PageHeader
        title="Reports to review"
        subtitle={waiting.length ? `${waiting.length} waiting · oldest ${oldest === 0 ? "today" : `${oldest} days`}` : "Nothing waiting for review"}
      />
      <ErrorNote message={actionError ?? queue.error?.message ?? drafts.error?.message ?? recent.error?.message ?? inspections.error?.message ?? signatories.error?.message} />
      {person.roles.includes("management") && <section className="mb-7">
        <SectionTitle>Prepare report from field data</SectionTitle>
        <Card><form action={prepareReport} className="space-y-4">
          <Field label="Submitted inspection" hint="Required readings are checked again on the server. Report numbering is entered manually until BITA confirms its rule.">
            <Select name="inspection_id" required defaultValue=""><option value="" disabled>Choose submitted field data</option>
              {(inspections.data ?? []).map((inspection) => <option key={inspection.id} value={inspection.id} disabled={inspection.missing_fields.length > 0}>
                {inspection.jobs?.job_no} · {inspection.jobs?.customers?.name} · {METHOD_LABEL[inspection.method]} · {inspection.id.slice(0, 8)}{inspection.missing_fields.length ? " — missing readings" : ""}
              </option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="BITA report number"><Input name="report_no" required maxLength={120} /></Field>
            <Field label="Report date"><Input name="report_date" type="date" required defaultValue={today} /></Field>
          </div>
          <Field label="Signatory"><Select name="signatory_id" defaultValue=""><option value="">Use approving reviewer or manager</option>
            {(signatories.data ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
          </Select></Field>
          <Button type="submit" disabled={!inspections.data?.length}>Prepare report</Button>
        </form></Card>
      </section>}

      <section className="mb-7">
        <List>
          {waiting.map((r) => {
            const missing = r.inspections?.missing_fields ?? [];
            return (
              <ListRow
                key={r.id}
                tone={missing.length ? "wait" : "bad"}
                title={
                  <>
                    <Mono>{r.report_no}</Mono>
                    <span className="ml-3 font-normal text-ink-2">
                      {METHOD_LABEL[r.method]} · {r.jobs?.customers?.name}
                    </span>
                  </>
                }
                detail={missing.length ? `Missing: ${missing.join(", ")}` : "Field data complete"}
                action={
                  <ButtonLink href={`/review/${r.id}`} variant={missing.length ? "secondary" : "primary"} size="sm">
                    {missing.length ? "Ask technician" : "Review"}
                  </ButtonLink>
                }
              />
            );
          })}
          {waiting.length === 0 && <EmptyRow>No reports waiting. New ones appear here as soon as field data is in.</EmptyRow>}
        </List>
        <p className="mt-3 text-xs text-ink-3">Signatures and the company seal are added only after a reviewer approves.</p>
      </section>

      <div className="grid gap-7 lg:grid-cols-2">
        <section className="min-w-0">
          <SectionTitle>Being prepared</SectionTitle>
          <List>
            {(drafts.data ?? []).map((r) => (
              <ListRow
                key={r.id}
                tone="none"
                title={<Mono>{r.report_no}</Mono>}
                detail={`${METHOD_LABEL[r.method]} · ${r.jobs?.customers?.name ?? ""}`}
                action={<ButtonLink href={`/review/${r.id}`} variant="secondary" size="sm">Open draft</ButtonLink>}
              />
            ))}
            {drafts.data?.length === 0 && <EmptyRow>No drafts.</EmptyRow>}
          </List>
        </section>
        <section className="min-w-0">
          <SectionTitle>Recently approved</SectionTitle>
          <List>
            {(recent.data ?? []).map((r) => (
              <ListRow
                key={r.id}
                tone="ok"
                title={<Mono>{r.report_no}</Mono>}
                detail={`${METHOD_LABEL[r.method]} · ${r.jobs?.customers?.name ?? ""}`}
                action={<ButtonLink href={`/review/${r.id}`} variant="secondary" size="sm">Open report</ButtonLink>}
              />
            ))}
            {recent.data?.length === 0 && <EmptyRow>No approved reports yet.</EmptyRow>}
          </List>
        </section>
      </div>
    </>
  );
}
