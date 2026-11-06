import { redirect } from "next/navigation";
import { ButtonLink, EmptyRow, List, ListRow, Mono, PageHeader, SectionTitle, Status } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { daysBetween, shortDate, todayIST } from "@/lib/dates";
import { homeFor } from "@/lib/roles";
import { METHOD_LABEL } from "../jobs/labels";

export const metadata = { title: "Reports to review – BITA" };

// Reviewer home: the report queue (R26). Signatures and seal are added only after approval (R27).
export default async function ReviewQueue() {
  const { supabase, person } = await requireStaff();
  if (!person?.roles.some((r) => r === "reviewer" || r === "management")) redirect(homeFor(person?.roles));

  const [queue, drafts, recent] = await Promise.all([
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
                  <ButtonLink href={`/jobs/${r.jobs?.id}`} variant={missing.length ? "secondary" : "primary"} size="sm">
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
                action={<Status tone="none">Draft</Status>}
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
                action={r.approved_at && <span className="text-xs text-ink-3">{shortDate(r.approved_at.slice(0, 10))}</span>}
              />
            ))}
            {recent.data?.length === 0 && <EmptyRow>No approved reports yet.</EmptyRow>}
          </List>
        </section>
      </div>
    </>
  );
}
