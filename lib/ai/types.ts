import type { Database } from "../db/types";

export type TestMethod = Database["public"]["Enums"]["test_method"];

export const CANONICAL_TEST_METHODS: readonly TestMethod[] = [
  "UT",
  "MPT",
  "DPT",
  "RT",
  "VT",
  "hardness",
  "metallography",
  "RLA",
  "certification",
  "general_inspection",
] as const;

export type EnquiryUrgency = "low" | "normal" | "urgent";

/**
 * Shape of `enquiries.extracted` in the database.
 */
export interface ExtractedEnquiry {
  customer_hint: string | null;
  contact_name: string | null;
  component: string | null;
  quantity: number | null;
  test_methods: TestMethod[];
  site: string | null;
  urgency: EnquiryUrgency | null;
  summary: string | null;
}

export interface RawEnquiryInput {
  subject?: string | null;
  body?: string | null;
  sender?: string | null;
}

export interface MatchCustomerInput {
  sender?: string | null;
  senderEmail?: string | null;
  senderPhone?: string | null;
  customerHint?: string | null;
}

/**
 * Normalizes common NDT test method abbreviations and synonyms to BITA's canonical enum values.
 */
export function normalizeTestMethod(method: string): TestMethod | null {
  const trimmed = method.trim();
  const upper = trimmed.toUpperCase();

  switch (upper) {
    case "UT":
    case "ULTRASONIC":
    case "ULTRASONIC TESTING":
      return "UT";
    case "MPT":
    case "MT":
    case "MPI":
    case "MAGNETIC PARTICLE":
    case "MAGNETIC PARTICLE TESTING":
    case "MAGNETIC PARTICLE INSPECTION":
      return "MPT";
    case "DPT":
    case "PT":
    case "DP":
    case "LPT":
    case "LPI":
    case "DYE PENETRANT":
    case "DYE PENETRANT TESTING":
    case "LIQUID PENETRANT":
    case "LIQUID PENETRANT TESTING":
      return "DPT";
    case "RT":
    case "RADIOGRAPHY":
    case "RADIOGRAPHIC":
    case "RADIOGRAPHIC TESTING":
    case "X-RAY":
    case "XRAY":
      return "RT";
    case "VT":
    case "VISUAL":
    case "VISUAL TESTING":
    case "VISUAL INSPECTION":
      return "VT";
    case "HARDNESS":
    case "HARDNESS TESTING":
      return "hardness";
    case "METALLOGRAPHY":
      return "metallography";
    case "RLA":
    case "REMAINING LIFE ASSESSMENT":
      return "RLA";
    case "CERTIFICATION":
      return "certification";
    case "GENERAL_INSPECTION":
    case "GENERAL INSPECTION":
    case "GENERAL":
      return "general_inspection";
    default:
      if (CANONICAL_TEST_METHODS.includes(trimmed as TestMethod)) {
        return trimmed as TestMethod;
      }
      return null;
  }
}

/**
 * Normalizes an urgency string to "low" | "normal" | "urgent" | null.
 */
export function normalizeUrgency(urgency: unknown): EnquiryUrgency | null {
  if (typeof urgency !== "string") return null;
  const lower = urgency.trim().toLowerCase();
  if (lower === "urgent" || lower === "high" || lower === "critical" || lower === "asap" || lower === "immediate") {
    return "urgent";
  }
  if (lower === "normal" || lower === "medium" || lower === "standard") {
    return "normal";
  }
  if (lower === "low") {
    return "low";
  }
  return null;
}

/**
 * Hand-written type guard validating that an object conforms to ExtractedEnquiry.
 */
export function isExtractedEnquiry(obj: unknown): obj is ExtractedEnquiry {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return false;
  }

  const record = obj as Record<string, unknown>;

  // customer_hint: string | null
  if (record.customer_hint !== null && typeof record.customer_hint !== "string") {
    return false;
  }

  // contact_name: string | null
  if (record.contact_name !== null && typeof record.contact_name !== "string") {
    return false;
  }

  // component: string | null
  if (record.component !== null && typeof record.component !== "string") {
    return false;
  }

  // quantity: number | null
  if (record.quantity !== null && typeof record.quantity !== "number") {
    return false;
  }

  // test_methods: TestMethod[]
  if (!Array.isArray(record.test_methods)) {
    return false;
  }
  for (const m of record.test_methods) {
    if (typeof m !== "string" || !CANONICAL_TEST_METHODS.includes(m as TestMethod)) {
      return false;
    }
  }

  // site: string | null
  if (record.site !== null && typeof record.site !== "string") {
    return false;
  }

  // urgency: "low" | "normal" | "urgent" | null
  if (
    record.urgency !== null &&
    record.urgency !== "low" &&
    record.urgency !== "normal" &&
    record.urgency !== "urgent"
  ) {
    return false;
  }

  // summary: string | null
  if (record.summary !== null && typeof record.summary !== "string") {
    return false;
  }

  return true;
}

/**
 * Sanitizes and normalizes an untrusted parsed object into a clean ExtractedEnquiry,
 * or returns null if the object is invalid.
 */
export function normalizeExtractedEnquiry(raw: unknown): ExtractedEnquiry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const r = raw as Record<string, unknown>;

  const customer_hint =
    typeof r.customer_hint === "string" && r.customer_hint.trim().length > 0
      ? r.customer_hint.trim()
      : null;

  const contact_name =
    typeof r.contact_name === "string" && r.contact_name.trim().length > 0
      ? r.contact_name.trim()
      : null;

  const component =
    typeof r.component === "string" && r.component.trim().length > 0
      ? r.component.trim()
      : null;

  let quantity: number | null = null;
  if (typeof r.quantity === "number" && !Number.isNaN(r.quantity) && r.quantity > 0) {
    quantity = Math.floor(r.quantity);
  } else if (typeof r.quantity === "string") {
    const parsed = parseInt(r.quantity.trim(), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      quantity = parsed;
    }
  }

  // Support both `test_methods` and `methods` keys (some prompts or demo seeds use `methods`)
  const rawMethods = Array.isArray(r.test_methods)
    ? r.test_methods
    : Array.isArray(r.methods)
      ? r.methods
      : [];

  const test_methods: TestMethod[] = [];
  for (const item of rawMethods) {
    if (typeof item === "string") {
      const normalized = normalizeTestMethod(item);
      if (normalized && !test_methods.includes(normalized)) {
        test_methods.push(normalized);
      }
    }
  }

  const site =
    typeof r.site === "string" && r.site.trim().length > 0 ? r.site.trim() : null;

  const urgency = normalizeUrgency(r.urgency);

  const summary =
    typeof r.summary === "string" && r.summary.trim().length > 0
      ? r.summary.trim()
      : null;

  const result: ExtractedEnquiry = {
    customer_hint,
    contact_name,
    component,
    quantity,
    test_methods,
    site,
    urgency,
    summary,
  };

  return isExtractedEnquiry(result) ? result : null;
}
