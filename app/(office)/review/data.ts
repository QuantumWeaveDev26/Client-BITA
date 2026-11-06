import { notFound } from "next/navigation";
import { inspectionHash, inspectionProblems, readSnapshot, validId } from "@/lib/reports/review";
import { requireReportReviewer } from "./access";

export async function reportContext(id: string) {
  if (!validId(id)) notFound();
  const context = await requireReportReviewer();
  const { supabase } = context;
  const { data: report, error } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("The report could not be loaded. Please try again.");
  if (!report) notFound();
  const [inspectionResult, jobResult] = await Promise.all([
    report.inspection_id ? supabase.from("inspections").select("*").eq("id", report.inspection_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("jobs").select("id, job_no, status, customer_id, customers(name)").eq("id", report.job_id).maybeSingle(),
  ]);
  if (inspectionResult.error || jobResult.error) throw new Error("The linked job or field data could not be loaded. Please try again.");
  const inspection = inspectionResult.data;
  const snapshot = readSnapshot(report.content);
  const sameSource = !!inspection && !!snapshot && inspection.job_id === report.job_id && inspection.method === report.method && snapshot.sourceHash === inspectionHash(inspection);
  const problems = inspection ? inspectionProblems(inspection) : ["No inspection is linked to this report."];
  return { ...context, report, inspection, snapshot, sameSource, problems, job: jobResult.data };
}
