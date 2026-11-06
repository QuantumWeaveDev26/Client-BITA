import Link from "next/link";
import {
  Button,
  Card,
  EmptyRow,
  ErrorNote,
  Field,
  Input,
  List,
  ListRow,
  SavedNote,
  SectionTitle,
  Select,
  Textarea,
} from "@/components/ui";
import { requireTechnician } from "@/lib/auth";
import { shortDate } from "@/lib/dates";
import type { Enums } from "@/lib/db/types";
import { submitTechnicianIssue } from "./actions";

export const metadata = { title: "Report an issue – BITA" };

const ISSUE_KIND_LABEL: Record<Enums<"technician_message_kind">, string> = {
  delay: "Delay reaching site",
  leave: "Leave / absence",
  equipment_problem: "Equipment problem",
  site_issue: "Site access or safety issue",
  other: "Other note",
  acknowledgement: "Acknowledgement",
  completion: "Completion",
};

export default async function ReportIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; assignment?: string }>;
}) {
  const { error, saved, assignment: preselectedAssignment } = await searchParams;
  const { supabase, person } = await requireTechnician();

  const [assignmentsRes, messagesRes] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, work_date, jobs(id, job_no, site, customers(name))")
      .eq("person_id", person.id)
      .order("work_date", { ascending: false })
      .limit(20),
    supabase
      .from("technician_messages")
      .select("id, kind, body, media_paths, received_at, jobs(job_no)")
      .eq("person_id", person.id)
      .order("received_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/my-jobs" className="text-[13px] text-ink-2 hover:text-ink">
          &larr; Today&apos;s work
        </Link>
        <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Report a delay, leave or problem
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-2">
          Notify the office immediately about site delays, leave, equipment faults or site issues.
        </p>
      </div>

      <ErrorNote message={error} />
      {saved && <SavedNote />}

      <Card>
        <form action={submitTechnicianIssue} className="space-y-4">
          <Field label="What are you reporting? *">
            <Select name="kind" defaultValue="delay" required>
              <option value="delay">Delay reaching site</option>
              <option value="leave">Leave / absence</option>
              <option value="equipment_problem">Equipment problem</option>
              <option value="site_issue">Site access or safety issue</option>
              <option value="other">Other note</option>
            </Select>
          </Field>

          <Field label="Related job (optional)">
            <Select name="assignment_id" defaultValue={preselectedAssignment ?? ""}>
              <option value="">General / not tied to one job</option>
              {(assignmentsRes.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.jobs?.job_no ?? "Job"} · {a.jobs?.customers?.name ?? ""}{" "}
                  {a.jobs?.site ? `(${a.jobs.site})` : ""} – {shortDate(a.work_date)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Details *" hint="Explain the delay, leave dates, equipment serial or site problem.">
            <Textarea name="body" required rows={4} />
          </Field>

          <Field label="Photo (optional)" hint="Attach a photo of the equipment fault or site condition.">
            <Input type="file" name="photo" accept="image/*" />
          </Field>

          <Button type="submit" className="w-full py-3 text-[15px]">
            Send to office
          </Button>
        </form>
      </Card>

      <div>
        <SectionTitle>Recent updates sent</SectionTitle>
        <List>
          {(messagesRes.data ?? []).length === 0 ? (
            <EmptyRow>No updates reported yet.</EmptyRow>
          ) : (
            (messagesRes.data ?? []).map((m) => (
              <ListRow
                key={m.id}
                tone={m.kind === "equipment_problem" || m.kind === "site_issue" ? "bad" : "wait"}
                title={
                  <>
                    {ISSUE_KIND_LABEL[m.kind] ?? m.kind}
                    {m.jobs?.job_no ? ` · ${m.jobs.job_no}` : ""}
                  </>
                }
                detail={
                  <>
                    {m.body ?? "(photo attached)"} · {shortDate(m.received_at.slice(0, 10))}
                    {m.media_paths.length > 0 ? ` · ${m.media_paths.length} photo` : ""}
                  </>
                }
              />
            ))
          )}
        </List>
      </div>
    </div>
  );
}
