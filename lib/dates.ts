// Dates are stored in UTC and shown in Asia/Kolkata time (AGENTS.md conventions).
const TZ = "Asia/Kolkata";

// Today's date in India as YYYY-MM-DD, for comparing with date columns.
export function todayIST(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function longDateIST(d = new Date()): string {
  return d.toLocaleDateString("en-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
}

export function shortDate(isoDate: string): string {
  return new Date(isoDate + "T00:00:00+05:30").toLocaleDateString("en-IN", { timeZone: TZ, day: "numeric", month: "short" });
}

export function weekday(isoDate: string): string {
  return new Date(isoDate + "T00:00:00+05:30").toLocaleDateString("en-IN", { timeZone: TZ, weekday: "short" });
}

export function greeting(d = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hour12: false }).format(d));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}
