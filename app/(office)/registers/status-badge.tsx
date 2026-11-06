export function StatusBadge({ label }: { label: string }) {
  const warning = label === "Overdue" || label === "Expired";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${warning ? "bg-red-50 text-red-800" : label === "Due within 30 days" ? "bg-amber-50 text-amber-900" : "bg-neutral-100 text-neutral-700"}`}>{label}</span>;
}
