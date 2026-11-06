// Which home screen and menu each login gets (D-015). Management sees everything.
export type Role = "management" | "office" | "reviewer" | "technician";

export function homeFor(roles: readonly string[] | undefined): string {
  if (!roles || roles.length === 0) return "/login";
  if (roles.includes("management")) return "/dashboard";
  if (roles.includes("office")) return "/office";
  if (roles.includes("reviewer")) return "/review";
  if (roles.includes("technician")) return "/my-jobs";
  return "/login";
}

export function roleLabel(roles: readonly string[]): string {
  const names: Record<string, string> = { management: "Management", office: "Office", reviewer: "Reviewer", technician: "Technician" };
  return roles.map((r) => names[r] ?? r).join(" · ");
}
