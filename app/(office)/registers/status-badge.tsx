import { Status } from "@/components/ui";

// Certificate and calibration state, as a status dot plus words (DESIGN.md).
export function StatusBadge({ label }: { label: string }) {
  const tone = label === "Overdue" || label === "Expired" ? "bad" : label === "Due within 30 days" ? "wait" : label === "In date" ? "ok" : "none";
  return <Status tone={tone}>{label}</Status>;
}
