// Read a trimmed text field from a form; empty becomes null so the database stores "not given".
export function text(fd: FormData, name: string): string | null {
  const v = String(fd.get(name) ?? "").trim();
  return v === "" ? null : v;
}

export function checked(fd: FormData, name: string): boolean {
  return fd.get(name) === "on";
}

// Turns a database error into a sentence an office user can act on.
export function friendlyError(message: string): string {
  if (message.includes("customers_gstin_check")) return "GSTIN must be 15 characters, like 29ABCDE1234F1Z5.";
  if (message.includes("customers_code_key")) return "Another customer already uses this code.";
  if (message.includes("row-level security")) return "You do not have permission to do this.";
  return message;
}
