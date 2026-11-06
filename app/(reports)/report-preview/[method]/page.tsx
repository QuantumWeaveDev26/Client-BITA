import { notFound } from "next/navigation";
import { ButtonLink, Card, Mono, PageHeader, Status } from "@/components/ui";
import { isStaff, requireStaff } from "@/lib/auth";
import { ReportTemplate } from "@/templates/reports/report";
import { previewDocument } from "@/templates/reports/preview-data";
import { fakeSealSvgDataUrl, fakeSignatureSvgDataUrl } from "../../../../lib/reports/review";
import { PrintButton } from "./print-button";
import "@/templates/reports/report.css";

export const metadata = { title: "Report format preview – BITA" };

export default async function ReportPreview({
  params,
  searchParams,
}: {
  params: Promise<{ method: string }>;
  searchParams?: Promise<{ approved?: string }>;
}) {
  const { person } = await requireStaff();
  if (!person || !isStaff(person.roles)) notFound();

  const rawMethod = (await params).method.toUpperCase();
  const method = rawMethod === "MT" ? "MPT" : rawMethod;
  if (method !== "UT" && method !== "MPT" && method !== "DPT") notFound();

  const resolvedSearch = searchParams ? await searchParams : undefined;
  const showApproved = resolvedSearch?.approved === "1";
  const doc = previewDocument(method);

  if (showApproved) {
    doc.approval = {
      approved: true,
      approvedAt: "2026-11-06T08:00:00Z",
      signatoryName: "FAKE TEST Reviewer (Level III)",
      signatoryQualification: "ASNT NDT Level III · UT / MT / PT (Fake Preview)",
      signatureUrl: fakeSignatureSvgDataUrl("FAKE TEST Reviewer"),
      sealUrl: fakeSealSvgDataUrl(),
    };
  }

  const activeTab = rawMethod === "MPT" ? "MT" : rawMethod;

  return (
    <main className="report-preview-shell mx-auto max-w-5xl px-4 py-6">
      <div className="report-preview-controls mb-6 space-y-4">
        <PageHeader
          title="Report format preview"
          subtitle={
            <>
              Fake data only (<Mono>{doc.reportNumber}</Mono>). Paper layout reproduces BITA&apos;s {activeTab} report grid; app controls follow the shared design system.
            </>
          }
          action={
            <>
              <ButtonLink href="/review" variant="secondary">
                Back to review
              </ButtonLink>
              <PrintButton />
            </>
          }
        />

        <Card className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Report methods" className="flex flex-wrap items-center gap-2">
            {(["UT", "MT", "DPT"] as const).map((tab) => (
              <ButtonLink
                key={tab}
                href={`/report-preview/${tab}${showApproved ? "?approved=1" : ""}`}
                variant={activeTab === tab ? "primary" : "secondary"}
                size="sm"
              >
                {tab}
              </ButtonLink>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <Status tone={showApproved ? "ok" : "wait"}>
              {showApproved ? "Approved preview (fake signature & seal)" : "Draft preview (signature & seal withheld)"}
            </Status>
            <ButtonLink
              href={`/report-preview/${activeTab}${showApproved ? "" : "?approved=1"}`}
              variant="secondary"
              size="sm"
            >
              {showApproved ? "Show draft state" : "Preview approved state"}
            </ButtonLink>
          </div>
        </Card>
      </div>

      <div className="report-preview-paper">
        <ReportTemplate method={method} document={doc} />
      </div>
    </main>
  );
}
