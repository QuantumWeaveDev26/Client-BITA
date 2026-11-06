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
  List,
  ListRow,
  Mono,
  SavedNote,
  SectionTitle,
  Select,
  Status,
} from "@/components/ui";
import { requireTechnician } from "@/lib/auth";
import { shortDate } from "@/lib/dates";
import { METHOD_LABEL } from "../../../(office)/jobs/labels";
import { acknowledge } from "../actions";
import { saveMethodReadings, uploadJobAttachment } from "./actions";
import { ReadingsForm } from "./readings-form";

const ATTACHMENT_KIND_LABEL: Record<string, string> = {
  site_photo: "Site photo",
  defect_photo: "Defect photo",
  drawing: "Drawing / sketch",
  supporting_document: "Supporting document",
  other: "Other file",
};

export default async function AssignmentReadingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ method?: string; saved?: string; error?: string }>;
}) {
  const { assignmentId } = await params;
  const { method: activeMethodParam, saved, error } = await searchParams;
  const { supabase, person } = await requireTechnician();

  const { data: assignment } = await supabase
    .from("assignments")
    .select(
      "id, job_id, work_date, acknowledged_at, completed_at, notes, jobs(id, job_no, site, scope, test_methods, customers(name)), assignment_equipment(equipment(kind, make, model, serial_no, calibration_due))",
    )
    .eq("id", assignmentId)
    .eq("person_id", person.id)
    .maybeSingle();

  if (!assignment || !assignment.jobs) notFound();
  const job = assignment.jobs;

  const [inspectionsRes, qualsRes, attachmentsRes] = await Promise.all([
    supabase
      .from("inspections")
      .select("id, method, readings, observations, missing_fields, submitted_at")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("qualifications")
      .select("method, level, scheme, certificate_no, issued_on, valid_until")
      .eq("person_id", person.id),
    supabase
      .from("attachments")
      .select("id, kind, caption, storage_path, uploaded_at")
      .eq("job_id", job.id)
      .order("uploaded_at", { ascending: false }),
  ]);

  const methods = job.test_methods.length > 0 ? job.test_methods : (["UT"] as const);
  const selectedMethod =
    methods.find((m) => m === activeMethodParam) ?? methods[0];

  const firstEq = assignment.assignment_equipment[0]?.equipment;
  const defaultEquipmentName = firstEq
    ? [firstEq.make, firstEq.model].filter(Boolean).join(" ") || firstEq.kind
    : "";
  const defaultEquipmentSerial = firstEq?.serial_no ?? "";

  const signedAttachments = await Promise.all(
    (attachmentsRes.data ?? []).map(async (att) => {
      const signed = await supabase.storage.from("documents").createSignedUrl(att.storage_path, 600);
      return {
        ...att,
        signedUrl: signed.data?.signedUrl ?? null,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/my-jobs" className="text-[13px] text-ink-2 hover:text-ink">
          &larr; Today&apos;s work
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
            <Mono>{job.job_no}</Mono>
          </h1>
          <div className="flex flex-wrap gap-1.5">
            {job.test_methods.map((m) => (
              <Badge key={m}>{METHOD_LABEL[m]}</Badge>
            ))}
          </div>
        </div>
        <p className="mt-1 text-[15px] font-medium text-ink">{job.customers?.name}</p>
        <p className="text-[13.5px] text-ink-2">
          {[job.site, job.scope, `Work date: ${shortDate(assignment.work_date)}`].filter(Boolean).join(" · ")}
        </p>
      </div>

      <ErrorNote message={error} />
      {saved && <SavedNote />}

      {!assignment.acknowledged_at && (
        <Card className="space-y-3">
          <Status tone="wait">Please confirm you have seen this assignment before starting site work.</Status>
          <form action={acknowledge.bind(null, assignment.id)}>
            <Button type="submit" className="w-full py-2.5 text-[14px]">
              I&apos;ve seen this job
            </Button>
          </form>
        </Card>
      )}

      {(assignment.assignment_equipment.length > 0 || assignment.notes) && (
        <Card className="space-y-2">
          {assignment.assignment_equipment.length > 0 && (
            <div>
              <p className="text-[12.5px] font-medium text-ink-2">Assigned equipment</p>
              <ul className="mt-1 space-y-0.5 text-[13px] text-ink">
                {assignment.assignment_equipment.map((ae, i) => (
                  <li key={i}>
                    {[ae.equipment?.make, ae.equipment?.model].filter(Boolean).join(" ")} ·{" "}
                    <Mono>{ae.equipment?.serial_no}</Mono>
                    {ae.equipment?.calibration_due &&
                      ` · calibration due ${shortDate(ae.equipment.calibration_due)}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {assignment.notes && (
            <p className="rounded-lg bg-side px-3 py-2 text-[13px] text-ink-2">{assignment.notes}</p>
          )}
        </Card>
      )}

      {methods.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {methods.map((m) => {
            const insp = (inspectionsRes.data ?? []).find((i) => i.method === m);
            const complete = insp?.submitted_at && insp.missing_fields.length === 0;
            return (
              <ButtonLink
                key={m}
                href={`/my-jobs/${assignment.id}?method=${m}`}
                variant={m === selectedMethod ? "primary" : "secondary"}
                size="sm"
              >
                {METHOD_LABEL[m]}
                {complete ? " ✓" : insp ? ` (${insp.missing_fields.length} missing)` : ""}
              </ButtonLink>
            );
          })}
        </div>
      )}

      {methods
        .filter((m) => m === selectedMethod)
        .map((m) => {
          const existing = (inspectionsRes.data ?? []).find((i) => i.method === m);
          const qual = (qualsRes.data ?? []).find((q) => q.method === m);
          const defaultReadings: Record<string, unknown> = {
            client: job.customers?.name ?? "",
            project: job.scope ?? "",
            inspection_site: job.site ?? "",
            inspection_date: assignment.work_date,
            equipment: defaultEquipmentName,
            equipment_serial: defaultEquipmentSerial,
            technicians: [
              {
                name: person.full_name,
                qualification: qual ? [qual.scheme, qual.level].filter(Boolean).join(" ") : "",
                certificate_no: qual?.certificate_no ?? "",
                issued_on: qual?.issued_on ?? "",
                valid_until: qual?.valid_until ?? "",
              },
            ],
            items: [{ description: "", quantity: 1, observations: "" }],
          };

          const existingReadings =
            existing?.readings &&
            typeof existing.readings === "object" &&
            !Array.isArray(existing.readings)
              ? (existing.readings as Record<string, unknown>)
              : defaultReadings;

          return (
            <ReadingsForm
              key={m}
              action={saveMethodReadings.bind(null, assignment.id, m)}
              method={m}
              initialReadings={existingReadings}
              initialObservations={existing?.observations ?? null}
              missingFields={existing?.missing_fields ?? []}
              submittedAt={existing?.submitted_at ?? null}
            />
          );
        })}

      <Card className="space-y-4">
        <SectionTitle>Photos and drawings</SectionTitle>
        <form action={uploadJobAttachment.bind(null, assignment.id)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kind">
              <Select name="kind" defaultValue="site_photo">
                <option value="site_photo">Site photo</option>
                <option value="defect_photo">Defect photo</option>
                <option value="drawing">Drawing / sketch</option>
                <option value="supporting_document">Supporting document</option>
              </Select>
            </Field>
            <Field label="Caption">
              <Input name="caption" placeholder="e.g. Weld W-12 indication at 140 mm" />
            </Field>
          </div>
          <Field label="File *" hint="Take a photo or choose an image / PDF.">
            <Input type="file" name="file" accept="image/*,application/pdf" required />
          </Field>
          <Button type="submit" className="w-full py-2.5">
            Upload photo or drawing
          </Button>
        </form>

        {signedAttachments.length > 0 && (
          <List>
            {signedAttachments.map((att) => (
              <ListRow
                key={att.id}
                tone="ok"
                title={att.caption ?? att.storage_path.split("/").pop() ?? "Attachment"}
                detail={ATTACHMENT_KIND_LABEL[att.kind] ?? att.kind}
                action={
                  att.signedUrl ? (
                    <a
                      href={att.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-medium text-ink underline"
                    >
                      Open
                    </a>
                  ) : undefined
                }
              />
            ))}
          </List>
        )}
      </Card>
    </div>
  );
}
