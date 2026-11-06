"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Json } from "@/lib/db/types";
import { text } from "@/lib/forms";
import { makeSnapshot, recipients, reportFilePath, reviewError, validId } from "@/lib/reports/review";
import { reportContext } from "./data";
import { requireReportReviewer } from "./access";

function fail(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(reviewError(message))}`); }
function failure(error: unknown) { return error instanceof Error ? error.message : "The operation could not be completed. Please try again."; }
function done(id: string): never {
  revalidatePath("/review"); revalidatePath(`/review/${id}`); revalidatePath("/dashboard"); revalidatePath("/office");
  redirect(`/review/${id}?saved=1`);
}

export async function prepareReport(fd: FormData) {
  const { supabase, person } = await requireReportReviewer();
  if (!person.roles.includes("management")) fail("/review", "Only management can enter a new BITA report number.");
  const inspectionId = text(fd, "inspection_id") ?? "";
  if (!validId(inspectionId)) fail("/review", "Choose a submitted inspection.");
  const { data: inspection, error } = await supabase.from("inspections").select("*").eq("id", inspectionId).maybeSingle();
  if (error || !inspection) fail("/review", "The inspection could not be loaded.");
  const reportNumber = text(fd, "report_no") ?? "";
  const reportDate = text(fd, "report_date") ?? "";
  const signatory = text(fd, "signatory_id");
  let content;
  try {
    reportFilePath(inspection.job_id, reportNumber);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || !Number.isFinite(Date.parse(reportDate)) || new Date(reportDate).toISOString().slice(0, 10) !== reportDate) throw new Error("Enter a valid report date.");
    if (signatory && !validId(signatory)) throw new Error("Choose a valid signatory.");
    content = makeSnapshot(inspection);
  } catch (problem) { fail("/review", failure(problem)); }
  if (signatory) {
    const { data: selected } = await supabase.from("people").select("roles, active").eq("id", signatory).maybeSingle();
    if (!selected?.active || !selected.roles.some((role) => role === "reviewer" || role === "management")) fail("/review", "Choose an active reviewer or management signatory.");
  }
  const { data, error: insertError } = await supabase.from("reports").insert({
    inspection_id: inspection.id, job_id: inspection.job_id, method: inspection.method, report_no: reportNumber,
    report_date: reportDate, content: content as unknown as Json, prepared_by: person.id, signatory_id: signatory, status: "draft",
  }).select("id").single();
  if (insertError || !data) fail("/review", insertError?.message ?? "Report preparation failed.");
  done(data.id);
}

export async function refreshReport(id: string) {
  const { supabase, report, inspection } = await reportContext(id);
  const path = `/review/${id}`;
  if (!["draft", "returned"].includes(report.status) || !inspection) fail(path, "Only a draft or returned report can be refreshed.");
  let content;
  try { content = makeSnapshot(inspection); } catch (error) { fail(path, failure(error)); }
  const { data, error } = await supabase.from("reports").update({ content: content as unknown as Json, status: "draft", reviewed_by: null,
    approved_by: null, approved_at: null, pdf_path: null, sent_at: null, sent_to: [] }).eq("id", id).eq("status", report.status).select("id").single();
  if (error || !data) fail(path, error?.message ?? "The report changed while you were editing it. Reload and try again.");
  done(id);
}

export async function sendForReview(id: string) {
  const { supabase, report, snapshot, sameSource, problems } = await reportContext(id);
  const path = `/review/${id}`;
  if (!["draft", "returned"].includes(report.status) || !sameSource || problems.length || !snapshot) fail(path, "Refresh this draft from complete submitted readings before sending it for review.");
  const { data, error } = await supabase.from("reports").update({ status: "in_review" }).eq("id", id).eq("status", report.status)
    .contains("content", { sourceHash: snapshot.sourceHash }).select("id").single();
  if (error || !data) fail(path, error?.message ?? "The report changed. Reload before sending it for review.");
  done(id);
}

// These transitions are wired to the coordinator's atomic database RPCs in the next step.
// Fail closed until that migration and the server PDF adapter are integrated.
export async function approveReport(id: string) { await reportContext(id); fail(`/review/${id}`, "Approval is waiting for the report-transition database migration."); }
export async function generateReportPdf(id: string) { await reportContext(id); fail(`/review/${id}`, "Signed PDF generation is being configured."); }
export async function returnReport(id: string, fd: FormData) {
  await reportContext(id);
  if (!text(fd, "note")) fail(`/review/${id}`, "Enter a correction note for the technician.");
  fail(`/review/${id}`, "Returning reports is waiting for the atomic notification database migration.");
}
export async function markReportSent(id: string, fd: FormData) {
  await reportContext(id);
  try { recipients(text(fd, "sent_to") ?? ""); } catch (error) { fail(`/review/${id}`, failure(error)); }
  fail(`/review/${id}`, "Manual sent tracking is waiting for the atomic database migration.");
}
