import type { Enums } from "../db/types";

export type ReportMethod = Extract<Enums<"test_method">, "UT" | "MPT" | "DPT">;
export type ReportMethodInput = ReportMethod | "MT";
export type ReadingValue = string | number | null;
export type FieldDefinition = Readonly<{
  key: string;
  label: string;
  required: boolean;
  input: "text" | "date" | "number" | "textarea";
}>;

function field<const K extends string>(key: K, label: string, input: FieldDefinition["input"] = "text", required = true) {
  return { key, label, input, required } as const;
}

export const SHARED_FIELDS = [
  field("client", "Client"), field("project", "Project"),
  field("inspection_site", "Inspection site"), field("inspection_date", "Inspection date", "date"),
] as const;

export const TECHNICIAN_FIELDS = [
  field("name", "Technician name"), field("qualification", "Qualification"),
  field("certificate_no", "Certificate number"), field("issued_on", "Issue date", "date"),
  field("valid_until", "Valid until", "date"),
] as const;

export const ITEM_FIELDS = [
  field("description", "Item description", "textarea"), field("quantity", "Quantity", "number"),
  field("observations", "Observations / remarks", "textarea"),
] as const;

// Table 4.4 and the paper formats. MT is stored as MPT in the database enum.
// Observations are required for every item, rather than duplicated in a separate scalar field.
export const METHOD_FIELDS = {
  UT: [
    field("equipment", "Equipment used"), field("equipment_serial", "Equipment serial number"),
    field("probes", "Probe used"), field("reference_blocks", "Reference blocks"),
    field("screen_range", "Screen range"), field("sensitivity", "Sensitivity level"),
    field("scanning_level", "Scanning level"), field("couplant", "Couplant"),
    field("surface_condition", "Surface condition"), field("standard", "Standard followed"),
    field("acceptance_criteria", "Acceptance criteria"),
  ],
  MPT: [
    field("equipment", "Yoke / equipment used"), field("equipment_serial", "Equipment serial number"),
    field("magnetic_medium", "Magnetic medium"), field("standard", "Standard followed"),
    field("magnetisation_method", "Magnetisation method"), field("current", "Current used"),
    field("visible_light_intensity", "Visible light intensity"),
    field("black_light", "Black light device", "text", false),
    field("black_light_intensity", "Black light intensity"), field("test_block", "Test block"),
    field("yoke_lifting_capacity", "Lifting capacity of yoke"),
  ],
  DPT: [
    field("component_description", "Component description", "textarea"),
    field("cleaner", "Cleaner"), field("cleaner_batch", "Cleaner batch number"),
    field("penetrant", "Penetrant"), field("penetrant_batch", "Penetrant batch number"),
    field("developer", "Developer"), field("developer_batch", "Developer batch number"),
    field("standard", "Standard followed"), field("dwell_time", "Dwell time"),
    field("developing_time", "Developing time"),
  ],
} as const satisfies Record<ReportMethod, readonly FieldDefinition[]>;

export const REPEATING_GROUPS = [
  { key: "technicians", label: "Testing carried out by", minimumRows: 1, fields: TECHNICIAN_FIELDS },
  { key: "items", label: "Inspected items", minimumRows: 1, fields: ITEM_FIELDS },
] as const;

type SharedKey = (typeof SHARED_FIELDS)[number]["key"];
type MethodKey = (typeof METHOD_FIELDS)[ReportMethod][number]["key"];
export type TechnicianReadings = Partial<Record<(typeof TECHNICIAN_FIELDS)[number]["key"], ReadingValue>>;
export type ItemReadings = Partial<Record<(typeof ITEM_FIELDS)[number]["key"], ReadingValue>>;
export type ReportReadings = Partial<Record<SharedKey | MethodKey, ReadingValue>> & {
  technicians?: readonly TechnicianReadings[];
  items?: readonly ItemReadings[];
};

export function reportMethod(method: ReportMethodInput): ReportMethod {
  if (method === "MT") return "MPT";
  if (method !== "UT" && method !== "MPT" && method !== "DPT") throw new Error("Unsupported report method.");
  return method;
}

export function fieldsForMethod(method: ReportMethodInput): readonly FieldDefinition[] {
  return [...SHARED_FIELDS, ...METHOD_FIELDS[reportMethod(method)]];
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hasReading(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : typeof value === "number" && Number.isFinite(value);
}

/** Stable paths suitable for inspections.missing_fields and field-level form messages.
 * Rows are checked individually: one complete technician/item cannot hide another incomplete row.
 * Measures such as zero are present; null, whitespace, booleans and objects are not readings.
 */
export function missingFields(method: ReportMethodInput, readings: unknown): string[] {
  const values = record(readings);
  const missing: string[] = [];
  for (const definition of fieldsForMethod(method)) {
    if (definition.required && (!Object.hasOwn(values, definition.key) || !hasReading(values[definition.key]))) missing.push(definition.key);
  }
  for (const group of REPEATING_GROUPS) {
    const rows = Object.hasOwn(values, group.key) ? values[group.key] : undefined;
    if (!Array.isArray(rows) || rows.length < group.minimumRows) { missing.push(group.key); continue; }
    // Array.from also visits holes in sparse input instead of silently treating them as complete.
    Array.from(rows).forEach((row, index) => {
      const entries = record(row);
      for (const definition of group.fields) {
        if (definition.required && (!Object.hasOwn(entries, definition.key) || !hasReading(entries[definition.key]))) missing.push(`${group.key}.${index}.${definition.key}`);
      }
    });
  }
  return missing;
}
