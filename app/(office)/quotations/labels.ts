import type { Enums } from "@/lib/db/types";

export const QUOTATION_STATUS_LABEL: Record<Enums<"quotation_status">, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  superseded: "Superseded",
};

// R12: Default terms on quotations: payment within 30 days from invoice date; GST at 18% as applicable.
// R11: Quotations have no expiry date.
export const DEFAULT_QUOTATION_TERMS = "Payment within 30 days from invoice date; GST at 18% as applicable.";

export function formatDateIN(d: string | null) {
  if (!d) return "–";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}
