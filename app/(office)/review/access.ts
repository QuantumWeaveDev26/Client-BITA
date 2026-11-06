import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export async function requireReportReviewer() {
  const context = await requireStaff();
  if (!context.person?.roles.some((role) => role === "reviewer" || role === "management")) redirect(homeFor(context.person?.roles));
  return { ...context, person: context.person };
}
