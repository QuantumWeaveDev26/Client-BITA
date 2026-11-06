import { createHash } from "node:crypto";
import type { Json, Tables } from "../db/types";
import { missingFields, type ReportMethod, type ReportReadings } from "./fields";
import type { ReportLetterhead } from "../../templates/reports/types";

export type Inspection = Tables<"inspections">;
export type Report = Tables<"reports">;
export type Snapshot = { version: 1; sourceHash: string; submittedAt: string; readings: ReportReadings; observations: string | null };
export type Branding = ReportLetterhead & { logoPath?: string; sealPath: string };

export function supportedMethod(method: string): method is ReportMethod {
  return method === "UT" || method === "MPT" || method === "DPT";
}

export function validId(value: string) { return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value); }

function ordered(value: Json): Json {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key] ?? null)]));
  return value;
}

export function inspectionHash(inspection: Inspection) {
  return createHash("sha256").update(JSON.stringify(ordered({
    id: inspection.id, job_id: inspection.job_id, assignment_id: inspection.assignment_id,
    method: inspection.method, readings: inspection.readings, observations: inspection.observations,
    submitted_at: inspection.submitted_at, submitted_by: inspection.submitted_by,
  }))).digest("hex");
}

export function inspectionProblems(inspection: Inspection): string[] {
  if (!supportedMethod(inspection.method)) return ["Unsupported report format: this method has no approved paper template yet."];
  return [
    ...(!inspection.submitted_at ? ["Field data has not been submitted."] : []),
    ...new Set([...inspection.missing_fields, ...missingFields(inspection.method, inspection.readings)]),
  ];
}

export function makeSnapshot(inspection: Inspection): Snapshot {
  const problems = inspectionProblems(inspection);
  if (problems.length) throw new Error(`Report cannot be prepared: ${problems.join(", ")}`);
  return { version: 1, sourceHash: inspectionHash(inspection), submittedAt: inspection.submitted_at!, readings: inspection.readings as ReportReadings, observations: inspection.observations };
}

export function readSnapshot(content: Json): Snapshot | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  if (content.version !== 1 || typeof content.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(content.sourceHash) || typeof content.submittedAt !== "string" || !content.readings || typeof content.readings !== "object" || Array.isArray(content.readings)) return null;
  return content as unknown as Snapshot;
}

export function reportFilePath(jobId: string, reportNumber: string) {
  const number = reportNumber.trim();
  if (!validId(jobId) || !/^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,119}$/.test(number) || number.split("/").some((part) => !part || part === "." || part === ".." || part.trim() !== part)) {
    throw new Error("Use a report number with letters, numbers, spaces, dots, dashes or slashes; path traversal and blank segments are not allowed.");
  }
  return `reports/${jobId}/${number}.pdf`;
}

export function recipients(raw: string): string[] {
  const emails = [...new Set(raw.split(/[,;\n]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (!emails.length || emails.some((email) => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))) throw new Error("Enter valid recipient email addresses, separated by commas.");
  return emails;
}

export function brandingRecord(input: unknown): Branding {
  const b = input as Record<string, unknown> | null;
  const lines = (value: unknown): value is string[] => Array.isArray(value) && value.every((line) => typeof line === "string");
  if (!b || typeof b.name !== "string" || !b.name.trim() || !lines(b.addressLines) || !b.addressLines.length || (b.contactLines !== undefined && !lines(b.contactLines)) || typeof b.sealPath !== "string" || !b.sealPath.trim()) {
    throw new Error("Configure name, addressLines and sealPath in private branding/report-letterhead.json before generating a signed PDF.");
  }
  for (const key of ["logoPath", "sealPath"] as const) {
    if (b[key] !== undefined && (typeof b[key] !== "string" || !safeBrandingPath(b[key]))) throw new Error("Branding paths must be relative private bucket paths.");
  }
  // Only these fields cross into a paper document; untrusted arbitrary attributes are discarded.
  return { name: b.name, addressLines: b.addressLines, ...(b.contactLines ? { contactLines: b.contactLines as string[] } : {}), sealPath: b.sealPath, ...(b.logoPath ? { logoPath: b.logoPath as string } : {}) };
}

export function safeBrandingPath(path: string) {
  return !!path && !path.startsWith("/") && !path.includes(":") && !path.includes("\\") && path.split("/").every((part) => part && part !== "." && part !== "..");
}

export function reviewError(message: string) {
  if (message.includes("reports_report_no_key")) return "That report number is already in use. Open the existing report or enter a different number.";
  if (message.includes("not been submitted")) return "Ask the technician to submit the completed field data first.";
  if (message.includes("Mandatory readings missing")) return "Required field readings are missing. Ask the technician to complete and submit them.";
  if (message.includes("row-level security") || message.includes("permission denied")) return "Your role does not allow this action.";
  return message;
}
