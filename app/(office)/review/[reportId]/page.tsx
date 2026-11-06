import Link from "next/link";
import { Button, ButtonLink, Card, ErrorNote, Field, Input, PageHeader, SavedNote, SecondaryButton, SectionTitle, Status } from "@/components/ui";
import { fieldsForMethod, missingFields } from "@/lib/reports/fields";
import { approvalAssets, paperBranding } from "@/lib/reports/branding.server";
import { supportedMethod } from "@/lib/reports/review";
import { ReportTemplate } from "@/templates/reports/report";
import type { ReportDocument } from "@/templates/reports/types";
import { reportContext } from "../data";
import { ReviewReadings } from "../readings";
import { approveReport, generateReportPdf, refreshReport, returnReport, sendForReview, markReportSent } from "../actions";
import "@/templates/reports/report.css";

export const metadata = { title: "Technical report review – BITA" };
export const maxDuration = 60;

export default async function ReportReview({ params, searchParams }: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { reportId } = await params;
  const { error, saved } = await searchParams;
  const { report, inspection, snapshot, sameSource, problems, job, supabase, person } = await reportContext(reportId);
  const approved = report.status === "approved" || report.status === "sent";
  let paper: ReportDocument | null = null;
  let brandingError: string | undefined;
  if (snapshot && supportedMethod(report.method)) {
    try {
      const assets = approved && report.approved_at && report.approved_by
        ? await approvalAssets(supabase, report.signatory_id ?? report.approved_by, report.approved_at)
        : { ...(await paperBranding(supabase)), approval: { approved: false as const } };
      paper = { reportNumber: report.report_no, reportDate: report.report_date, readings: snapshot.readings, letterhead: assets.letterhead, approval: assets.approval };
    } catch (problem) {
      brandingError = problem instanceof Error ? problem.message : "Report branding is unavailable.";
      paper = { reportNumber: report.report_no, reportDate: report.report_date, readings: snapshot.readings,
        letterhead: { name: "Letterhead not configured", addressLines: [] }, approval: { approved: false } };
    }
  }
  const missing = inspection && supportedMethod(report.method) ? [...new Set([...inspection.missing_fields, ...missingFields(report.method, inspection.readings)])] : [];
  const canSubmit = ["draft", "returned"].includes(report.status) && sameSource && !problems.length;
  const canApprove = report.status === "in_review" && sameSource && !problems.length;

  return <>
    <div className="report-preview-controls space-y-5">
      <PageHeader title={report.report_no} subtitle={`${job?.job_no ?? "Job unavailable"} · ${report.method} · ${job?.customers?.name ?? "Customer unavailable"}`}
        action={<><ButtonLink href="/review" variant="secondary">Review queue</ButtonLink>{person.roles.includes("management") && <ButtonLink href={`/review/${report.id}/history`} variant="secondary">Correction history</ButtonLink>}{approved && report.pdf_path && <ButtonLink href={`/review/${report.id}/pdf`}>Download signed PDF</ButtonLink>}</>} />
      <ErrorNote message={error} />
      {saved && <SavedNote />}
      <Status tone={report.status === "sent" ? "ok" : report.status === "approved" ? "ok" : report.status === "returned" ? "bad" : "wait"}>{report.status.replaceAll("_", " ")}</Status>
      {!sameSource && <Card><Status tone="bad">Field data has changed or the report snapshot is missing. Refresh a draft from the current submitted data before review.</Status></Card>}
      {problems.length > 0 && <Card><SectionTitle>Submission blockers</SectionTitle><ul className="space-y-2">{problems.map((problem) => <li key={problem}><Status tone="bad">{problem}</Status></li>)}</ul></Card>}
      <div className="flex flex-wrap gap-3">
        {["draft", "returned"].includes(report.status) && <>
          <form action={refreshReport.bind(null, report.id)}><SecondaryButton type="submit">Refresh from submitted field data</SecondaryButton></form>
          <form action={sendForReview.bind(null, report.id)}><Button type="submit" disabled={!canSubmit}>Send for review</Button></form>
        </>}
        {report.status === "in_review" && <form action={approveReport.bind(null, report.id)}><Button type="submit" disabled={!canApprove}>Approve and generate PDF</Button></form>}
        {report.status === "approved" && !report.pdf_path && <form action={generateReportPdf.bind(null, report.id)}><Button type="submit" disabled={!sameSource}>Generate signed PDF</Button></form>}
      </div>
      {report.status !== "sent" && ["in_review", "approved"].includes(report.status) && <Card>
        <form action={returnReport.bind(null, report.id)} className="space-y-3">
          <Field label="Return note" hint="The technician will see this correction request on their assignment."><Input name="note" required maxLength={4000} /></Field>
          <SecondaryButton type="submit">Return to technician</SecondaryButton>
        </form>
      </Card>}
      {report.status === "approved" && report.pdf_path && <Card>
        <form action={markReportSent.bind(null, report.id)} className="space-y-3">
          <Field label="Sent to" hint="Comma-separated email addresses. This records a manual send; it does not send email."><Input name="sent_to" type="text" required defaultValue={report.sent_to.join(", ")} /></Field>
          <Button type="submit" disabled={!sameSource || !!problems.length}>Mark as sent</Button>
        </form>
      </Card>}
      {report.status === "sent" && <Card><p className="text-sm">Manually marked sent: {report.sent_at ? new Date(report.sent_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Date not recorded"}</p><p className="mt-2 break-words text-sm">Recipients: {report.sent_to.join(", ")}</p></Card>}
      <SectionTitle>Report snapshot preview</SectionTitle>
      <ErrorNote message={brandingError} />
      {!snapshot && <p className="text-sm text-ink-2">Refresh this draft to create a validated report snapshot.</p>}
    </div>
    {paper && supportedMethod(report.method) && <div className="report-preview-paper my-5"><ReportTemplate method={report.method} document={paper} /></div>}
    <div className="report-preview-controls mt-7 space-y-4">
      <SectionTitle>Current field data</SectionTitle>
      {inspection && supportedMethod(report.method) && <ReviewReadings method={report.method} readings={inspection.readings as NonNullable<typeof snapshot>["readings"]} missing={missing} />}
      {inspection?.assignment_id && <Link href={`/jobs/${report.job_id}/assign`} className="text-sm underline">Job assignment</Link>}
      <p className="text-xs text-ink-3">{supportedMethod(report.method) ? fieldsForMethod(report.method).length : 0} scalar fields plus technician and item rows are checked on the server. Approval and sending are also enforced in the database.</p>
    </div>
  </>;
}
