import { notFound } from "next/navigation";
import { ButtonLink, PageHeader } from "@/components/ui";
import { isStaff, requireStaff } from "@/lib/auth";
import { ReportTemplate } from "@/templates/reports/report";
import { previewDocument } from "@/templates/reports/preview-data";
import { PrintButton } from "./print-button";

export const metadata = { title: "Report format preview – BITA" };

export default async function ReportPreview({ params }: { params: Promise<{ method: string }> }) {
  const { person } = await requireStaff();
  if (!person || !isStaff(person.roles)) notFound();
  const input = (await params).method.toUpperCase();
  const method = input === "MT" ? "MPT" : input;
  if (method !== "UT" && method !== "MPT" && method !== "DPT") notFound();
  return <main className="report-preview-shell mx-auto max-w-5xl px-4 py-6">
    <div className="report-preview-controls mb-6 space-y-4">
      <PageHeader title="Report format preview" action={<PrintButton />} />
      <p className="text-sm">Fake data only. Compare this paper format with the Word originals. Signature and seal are withheld until a report has technical approval.</p>
      <nav aria-label="Report methods" className="flex flex-wrap gap-3">
        <ButtonLink href="/report-preview/UT">UT</ButtonLink>
        <ButtonLink href="/report-preview/MT">MT</ButtonLink>
        <ButtonLink href="/report-preview/DPT">DPT</ButtonLink>
      </nav>
    </div>
    <div className="report-preview-paper"><ReportTemplate method={method} document={previewDocument(method)} /></div>
  </main>;
}
