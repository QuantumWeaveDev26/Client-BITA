import "server-only";
import type { requireStaff } from "@/lib/auth";
import type { ReportApproval, ReportLetterhead } from "@/templates/reports/types";
import {
  DEFAULT_DEV_LETTERHEAD,
  fakeSealSvgDataUrl,
  fakeSignatureSvgDataUrl,
} from "./review";

type SupabaseClientType = Awaited<ReturnType<typeof requireStaff>>["supabase"];

async function downloadBrandingImageDataUrl(
  supabase: SupabaseClientType,
  path: string | null | undefined
): Promise<string | undefined> {
  if (!path || path.startsWith("/") || path.includes("..")) return undefined;
  try {
    const { data, error } = await supabase.storage.from("branding").download(path);
    if (error || !data || data.size > 2 * 1024 * 1024) return undefined;
    const mime = data.type || (path.endsWith(".svg") ? "image/svg+xml" : "image/png");
    const buf = Buffer.from(await data.arrayBuffer());
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export async function loadReportLetterhead(
  supabase: SupabaseClientType
): Promise<{ letterhead: ReportLetterhead; sealPath?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from("branding")
      .download("report-letterhead.json");
    if (!error && data && data.size <= 32 * 1024) {
      const parsed = JSON.parse(await data.text()) as Record<string, unknown>;
      if (
        typeof parsed.name === "string" &&
        parsed.name.trim() &&
        Array.isArray(parsed.addressLines)
      ) {
        const logoUrl =
          typeof parsed.logoPath === "string"
            ? await downloadBrandingImageDataUrl(supabase, parsed.logoPath)
            : undefined;
        return {
          letterhead: {
            name: parsed.name.trim(),
            addressLines: parsed.addressLines.map(String),
            contactLines: Array.isArray(parsed.contactLines)
              ? parsed.contactLines.map(String)
              : undefined,
            ...(logoUrl ? { logoUrl } : {}),
          },
          sealPath: typeof parsed.sealPath === "string" ? parsed.sealPath : undefined,
        };
      }
    }
  } catch {
    // Fall back to DEFAULT_DEV_LETTERHEAD in dev when branding bucket has no config file yet.
  }
  return { letterhead: DEFAULT_DEV_LETTERHEAD };
}

export async function loadReportApprovalAssets(
  supabase: SupabaseClientType,
  params: {
    approved: boolean;
    approvedAt: string | null;
    signatoryId: string | null;
    approvedBy: string | null;
  }
): Promise<{ letterhead: ReportLetterhead; approval: ReportApproval }> {
  const { letterhead, sealPath } = await loadReportLetterhead(supabase);

  if (!params.approved || !params.approvedAt) {
    return { letterhead, approval: { approved: false } };
  }

  const targetPersonId = params.signatoryId ?? params.approvedBy;
  let signatoryName = "Technical Reviewer";
  let signatoryQualification: string | undefined = "Technical Signatory";
  let signaturePath: string | null = null;

  if (targetPersonId) {
    const { data: person } = await supabase
      .from("people")
      .select("full_name, position, signature_path")
      .eq("id", targetPersonId)
      .maybeSingle();
    if (person) {
      signatoryName = person.full_name;
      signatoryQualification = person.position ?? undefined;
      signaturePath = person.signature_path;
    }
  }

  const [realSigUrl, realSealUrl] = await Promise.all([
    downloadBrandingImageDataUrl(supabase, signaturePath),
    downloadBrandingImageDataUrl(supabase, sealPath ?? "seal.png"),
  ]);

  return {
    letterhead,
    approval: {
      approved: true,
      approvedAt: params.approvedAt,
      signatoryName,
      ...(signatoryQualification ? { signatoryQualification } : {}),
      signatureUrl: realSigUrl ?? fakeSignatureSvgDataUrl(signatoryName),
      sealUrl: realSealUrl ?? fakeSealSvgDataUrl(),
    },
  };
}
