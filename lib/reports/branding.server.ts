import "server-only";
import { brandingRecord, safeBrandingPath, type Branding } from "./review";
import type { ReportApproval, ReportLetterhead } from "../../templates/reports/types";
import type { requireStaff } from "../auth";

type Client = Awaited<ReturnType<typeof requireStaff>>["supabase"];

export async function loadBranding(supabase: Client): Promise<Branding> {
  const { data, error } = await supabase.storage.from("branding").download("report-letterhead.json");
  if (error || !data || data.size > 32 * 1024) throw new Error("Upload report-letterhead.json to the private branding bucket before issuing a PDF.");
  let parsed: unknown;
  try { parsed = JSON.parse(await data.text()); } catch { throw new Error("The report letterhead configuration is not valid JSON."); }
  return brandingRecord(parsed);
}

async function image(supabase: Client, path: string): Promise<string> {
  if (!safeBrandingPath(path)) throw new Error("The configured branding asset path is invalid.");
  const { data, error } = await supabase.storage.from("branding").download(path);
  if (error || !data) throw new Error("A configured signature, seal or logo could not be loaded from private branding storage.");
  if (data.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/svg+xml"].includes(data.type)) throw new Error("Branding images must be PNG, JPEG or SVG files of 2 MB or less.");
  return `data:${data.type};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}

export async function paperBranding(supabase: Client): Promise<{ letterhead: ReportLetterhead; config: Branding }> {
  const config = await loadBranding(supabase);
  return { config, letterhead: { name: config.name, addressLines: config.addressLines, contactLines: config.contactLines,
    ...(config.logoPath ? { logoUrl: await image(supabase, config.logoPath) } : {}) } };
}

export async function approvalAssets(supabase: Client, signatoryId: string, approvedAt: string): Promise<{
  letterhead: ReportLetterhead; approval: Extract<ReportApproval, { approved: true }>;
}> {
  const [{ letterhead, config }, signatoryResult] = await Promise.all([
    paperBranding(supabase),
    supabase.from("people").select("full_name, roles, active, position, signature_path").eq("id", signatoryId).maybeSingle(),
  ]);
  const signatory = signatoryResult.data;
  if (signatoryResult.error || !signatory?.active || !signatory.roles.some((role) => role === "reviewer" || role === "management") || !signatory.signature_path) {
    throw new Error("Choose an active reviewer or manager with a configured signature before issuing the PDF.");
  }
  const [signatureUrl, sealUrl] = await Promise.all([image(supabase, signatory.signature_path), image(supabase, config.sealPath)]);
  return { letterhead, approval: { approved: true, approvedAt, signatoryName: signatory.full_name,
    ...(signatory.position ? { signatoryQualification: signatory.position } : {}), signatureUrl, sealUrl } };
}
