import type { Enums } from "@/lib/db/types";

export const SOURCE_LABEL: Record<Enums<"enquiry_source">, string> = {
  email: "Email",
  phone: "Phone",
  whatsapp: "WhatsApp",
};

export const STATUS_LABEL: Record<Enums<"enquiry_status">, string> = {
  new: "New",
  linked: "Customer linked",
  quoted: "Quoted",
  converted: "Job created",
  closed: "Closed",
};

// Shown in Asia/Kolkata time (AGENTS.md conventions).
export function formatIST(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
