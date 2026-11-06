import type { Enums } from "../../../lib/db/types";

export const MAX_QUOTATION_FILE_BYTES = 6 * 1024 * 1024; // 6 MB

export const QUOTATION_FILE_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const EXTENSION_CONTENT_TYPE: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const MIME_TO_EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

export type QuotationFileValidation =
  | { ok: true; contentType: string; extension: string }
  | { ok: false; error: string };

export function validateQuotationFile(file: {
  name: string;
  size: number;
  type?: string;
}): QuotationFileValidation {
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return { ok: false, error: "Please choose a quotation file to upload." };
  }
  if (file.size > MAX_QUOTATION_FILE_BYTES) {
    return { ok: false, error: "The quotation file must be 6 MB or smaller." };
  }

  const trimmedName = (file.name ?? "").trim();
  const dotIndex = trimmedName.lastIndexOf(".");
  const ext = dotIndex >= 0 ? trimmedName.slice(dotIndex).toLowerCase() : "";
  const mime = (file.type ?? "").toLowerCase().trim();

  if (ext && EXTENSION_CONTENT_TYPE[ext]) {
    return {
      ok: true,
      extension: ext,
      contentType: EXTENSION_CONTENT_TYPE[ext],
    };
  }

  if (mime && MIME_TO_EXTENSION[mime]) {
    const resolvedExt = MIME_TO_EXTENSION[mime];
    return {
      ok: true,
      extension: resolvedExt,
      contentType: mime,
    };
  }

  return {
    ok: false,
    error: "Only PDF (.pdf) or Word (.doc, .docx) quotation files are allowed.",
  };
}

export function buildQuotationStoragePath(
  quotationId: string,
  fileName: string,
  nowMs: number = Date.now(),
): string {
  const cleanName = (fileName || "quotation.pdf").replace(/[^\w.-]+/g, "_");
  return `quotations/${quotationId}/${nowMs}-${cleanName}`;
}

export function quotationFileName(pdfPath: string | null | undefined): string | null {
  if (!pdfPath) return null;
  const segments = pdfPath.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return null;
  return last.replace(/^\d{10,}-/, "");
}

export function isValidQuotationStoragePath(quotationId: string, pdfPath: string | null | undefined): boolean {
  if (!pdfPath) return false;
  if (!pdfPath.startsWith(`quotations/${quotationId}/`)) return false;
  const parts = pdfPath.split("/");
  if (parts.length < 3) return false;
  return !parts.some((p) => p === "." || p === ".." || p.length === 0);
}

export function calculateQuotationTotal(
  items: ReadonlyArray<{ rate: number | null; minimum_charge?: number | null }>,
): number {
  let total = 0;
  for (const item of items) {
    const rate = item.rate !== null && item.rate !== undefined ? Number(item.rate) : NaN;
    const minCharge =
      item.minimum_charge !== null && item.minimum_charge !== undefined ? Number(item.minimum_charge) : NaN;
    if (Number.isFinite(rate) && rate > 0) {
      total += rate;
    } else if (Number.isFinite(minCharge) && minCharge > 0) {
      total += minCharge;
    }
  }
  return Math.round(total * 100) / 100;
}

export type QuotationDisplayTone = "ok" | "wait" | "bad" | "info" | "none";

export function quotationStatusDisplay(quotation: {
  status: Enums<"quotation_status">;
  superseded_by?: string | null;
}): { label: string; tone: QuotationDisplayTone; isRejected: boolean } {
  if (quotation.status === "superseded" && !quotation.superseded_by) {
    return { label: "Rejected", tone: "bad", isRejected: true };
  }
  switch (quotation.status) {
    case "draft":
      return { label: "Draft", tone: "wait", isRejected: false };
    case "approved":
      return { label: "Approved", tone: "info", isRejected: false };
    case "sent":
      return { label: "Sent to customer", tone: "info", isRejected: false };
    case "accepted":
      return { label: "Accepted by customer", tone: "ok", isRejected: false };
    case "superseded":
      return { label: "Superseded", tone: "none", isRejected: false };
  }
}

export function prefillJobDefaultsFromQuotation(input: {
  quotation?: {
    id: string;
    customer_id: string;
    enquiry_id: string | null;
    subject: string | null;
    quotation_items?: ReadonlyArray<{
      description: string;
      basis?: string | null;
      rate?: number | null;
    }>;
  } | null;
  enquiry?: {
    id: string;
    customer_id: string | null;
    subject: string | null;
    extracted?: unknown;
  } | null;
  customerParam?: string;
  validMethods: readonly Enums<"test_method">[];
}): {
  customer_id?: string;
  enquiry_id?: string;
  quotation_id?: string;
  scope?: string;
  site?: string;
  test_methods?: Enums<"test_method">[];
} {
  const { quotation, enquiry, customerParam, validMethods } = input;
  const customerId = quotation?.customer_id ?? enquiry?.customer_id ?? customerParam ?? undefined;
  const enquiryId = quotation?.enquiry_id ?? enquiry?.id ?? undefined;
  const quotationId = quotation?.id ?? undefined;

  const itemDescriptions = (quotation?.quotation_items ?? [])
    .map((it) => it.description.trim())
    .filter(Boolean);

  let scope = quotation?.subject?.trim() || enquiry?.subject?.trim() || "";
  if (itemDescriptions.length > 0) {
    const joinedItems = itemDescriptions.join("; ");
    if (!scope) {
      scope = joinedItems;
    } else if (!scope.toLowerCase().includes(itemDescriptions[0].toLowerCase())) {
      scope = `${scope} — ${joinedItems}`;
    }
  }

  let site: string | undefined;
  let testMethods: Enums<"test_method">[] | undefined;

  if (enquiry?.extracted && typeof enquiry.extracted === "object" && !Array.isArray(enquiry.extracted)) {
    const ext = enquiry.extracted as Record<string, unknown>;
    if (typeof ext.site === "string" && ext.site.trim()) {
      site = ext.site.trim();
    }
    if (Array.isArray(ext.test_methods)) {
      const matched = ext.test_methods
        .map((m) => String(m))
        .filter((m): m is Enums<"test_method"> => validMethods.includes(m as Enums<"test_method">));
      if (matched.length > 0) {
        testMethods = matched;
      }
    }
  }

  return {
    customer_id: customerId,
    enquiry_id: enquiryId,
    quotation_id: quotationId,
    scope: scope || undefined,
    site,
    test_methods: testMethods,
  };
}
