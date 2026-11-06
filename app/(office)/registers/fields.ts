import type { Enums, TablesInsert } from "@/lib/db/types";
import { checked, text } from "../../../lib/forms";

export const REGISTERS = ["people", "qualifications", "equipment"] as const;
export type Register = (typeof REGISTERS)[number];
export const TITLES: Record<Register, string> = {
  people: "People", qualifications: "Qualifications", equipment: "Equipment",
};
export const ROLES = ["management", "office", "reviewer", "technician"] as const satisfies readonly Enums<"app_role">[];
export const METHODS = ["UT", "MPT", "DPT", "RT", "VT", "hardness", "metallography", "RLA", "certification", "general_inspection"] as const satisfies readonly Enums<"test_method">[];
export const KINDS = { ut_flaw_detector: "UT flaw detector", mpi_yoke: "MPI yoke" } satisfies Record<Enums<"equipment_kind">, string>;
export const MAX_CERTIFICATE_BYTES = 5 * 1024 * 1024;
export const CERTIFICATE_TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" } as const;

export function isRegister(value: string): value is Register {
  return REGISTERS.some((r) => r === value);
}

export function isId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function required(fd: FormData, name: string, label: string): string {
  const value = text(fd, name);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function date(fd: FormData, name: string): string | null {
  const value = text(fd, name);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error("Enter a valid date.");
  }
  return value;
}

function dates(fd: FormData, first: string, last: string) {
  const start = date(fd, first);
  const end = date(fd, last);
  if (start && end && end < start) throw new Error("The expiry or due date cannot be before the issue or calibration date.");
  return [start, end] as const;
}

export function personFields(fd: FormData): TablesInsert<"people"> {
  const roles = fd.getAll("roles").map(String);
  if (roles.some((r) => !ROLES.some((role) => role === r))) throw new Error("Choose a valid role.");
  return {
    full_name: required(fd, "full_name", "Name"),
    initials: text(fd, "initials")?.toUpperCase() ?? null,
    position: text(fd, "position"), mobile: text(fd, "mobile"), email: text(fd, "email"),
    roles: [...new Set(roles)] as Enums<"app_role">[], active: checked(fd, "active"),
  };
}

export function qualificationFields(fd: FormData): TablesInsert<"qualifications"> {
  const personId = required(fd, "person_id", "Person");
  if (!isId(personId)) throw new Error("Choose a person from the register.");
  const method = required(fd, "method", "Method");
  if (!METHODS.some((m) => m === method)) throw new Error("Choose a valid test method.");
  const [issued_on, valid_until] = dates(fd, "issued_on", "valid_until");
  return {
    person_id: personId, method: method as Enums<"test_method">,
    level: required(fd, "level", "Level"), scheme: text(fd, "scheme"),
    certifying_body: text(fd, "certifying_body"), certificate_no: text(fd, "certificate_no"),
    issued_on, valid_until,
  };
}

export function equipmentFields(fd: FormData): TablesInsert<"equipment"> {
  const kind = required(fd, "kind", "Equipment kind");
  if (kind !== "ut_flaw_detector" && kind !== "mpi_yoke") throw new Error("Choose a valid equipment kind.");
  const [calibrated_on, calibration_due] = dates(fd, "calibrated_on", "calibration_due");
  return {
    kind, make: text(fd, "make"), model: text(fd, "model"), serial_no: text(fd, "serial_no"),
    calibrated_on, calibration_due, notes: text(fd, "notes"), active: checked(fd, "active"),
  };
}

// Calendar days in India: the due date itself is due soon, not overdue.
export function indiaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function calibrationStatus(due: string | null, today = indiaToday()) {
  if (!due) return "Date not recorded";
  if (due < today) return "Overdue";
  const days = (Date.parse(due) - Date.parse(today)) / 86_400_000;
  return days <= 30 ? "Due within 30 days" : "In date";
}

export function displayDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function certificateError(file: { size: number; type: string }): string | null {
  if (!Object.prototype.hasOwnProperty.call(CERTIFICATE_TYPES, file.type)) return "Choose a PDF, JPEG or PNG certificate.";
  if (file.size > MAX_CERTIFICATE_BYTES) return "The certificate must be 5 MB or smaller.";
  return null;
}
