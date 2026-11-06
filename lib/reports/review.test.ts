import { describe, expect, it } from "vitest";
import {
  checkReportReadiness,
  diffAuditRow,
  extractReadings,
  friendlyReportError,
  generateSignedReportPdfBytes,
  parseRecipients,
  reportPdfStoragePath,
} from "./review";
import { previewDocument } from "../../templates/reports/preview-data";

describe("lib/reports/review", () => {
  it("extracts readings from both snapshot objects and direct reading JSON", () => {
    const sample = previewDocument("UT").readings;
    expect(extractReadings({ version: 1, readings: sample } as never)).toEqual(sample);
    expect(extractReadings(sample as never)).toEqual(sample);
    expect(extractReadings({} as never, sample as never)).toEqual(sample);
  });

  it("checks report readiness against submitted_at and mandatory method readings", () => {
    const completeReadings = previewDocument("UT").readings;
    const ready = checkReportReadiness(
      "UT",
      { submitted_at: "2026-11-06T08:00:00Z", missing_fields: [], readings: completeReadings as never },
      completeReadings
    );
    expect(ready.ready).toBe(true);
    expect(ready.missing).toEqual([]);

    const unsubmitted = checkReportReadiness(
      "UT",
      { submitted_at: null, missing_fields: ["couplant"], readings: {} },
      { ...completeReadings, couplant: "" }
    );
    expect(unsubmitted.ready).toBe(false);
    expect(unsubmitted.missing).toContain("couplant");
    expect(unsubmitted.blockers.join(" ")).toContain("not been submitted");
  });

  it("builds safe storage paths inside the reports bucket", () => {
    const jobId = "77000000-0000-4000-8000-000000000005";
    expect(reportPdfStoragePath(jobId, "FAKE/UT/26-27/0101")).toBe(
      `reports/${jobId}/FAKE-UT-26-27-0101.pdf`
    );
    expect(() => reportPdfStoragePath("not-a-uuid", "FAKE/UT/01")).toThrow();
  });

  it("parses and validates comma-separated recipient emails", () => {
    expect(parseRecipients("QA@example.test,  client@example.test ; qa@example.test")).toEqual([
      "qa@example.test",
      "client@example.test",
    ]);
    expect(() => parseRecipients("not-an-email")).toThrow();
  });

  it("generates a valid PDF 1.4 binary document with approval metadata", () => {
    const bytes = generateSignedReportPdfBytes({
      reportNo: "FAKE/UT/26-27/0103",
      reportDate: "2026-11-06",
      method: "UT",
      jobNo: "BITA/26-27/0106",
      customerName: "Sample Forgings Pvt Ltd",
      readings: previewDocument("UT").readings,
      approval: {
        approved: true,
        approvedAt: "2026-11-06T09:00:00Z",
        signatoryName: "R. Demo Signatory",
        signatoryQualification: "Technical Director",
      },
    });
    const text = Buffer.from(bytes).toString("utf8");
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text).toContain("FAKE/UT/26-27/0103");
    expect(text).toContain("R. Demo Signatory");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("computes field-by-field and nested reading diffs for audit_log history (T9)", () => {
    const diffs = diffAuditRow(
      {
        status: "in_review",
        content: { sensitivity: "DAC -6 dB", couplant: "Grease" },
      },
      {
        status: "approved",
        content: { sensitivity: "DAC +2 dB", couplant: "Grease" },
      },
      ["status", "content"]
    );
    expect(diffs).toEqual([
      { field: "status", before: "in_review", after: "approved" },
      { field: "content.sensitivity", before: "DAC -6 dB", after: "DAC +2 dB" },
    ]);
  });

  it("maps database trigger errors to plain words", () => {
    expect(friendlyReportError("reports_report_no_key")).toContain("already in use");
    expect(friendlyReportError("Field data for this report has not been submitted")).toContain(
      "submit their readings first"
    );
  });
});
