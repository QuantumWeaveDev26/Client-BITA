import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types";
import type { MatchCustomerInput } from "./types";

/**
 * Extracts digit-only characters from a phone string and returns the last 10 digits
 * (standard Indian mobile length) or all digits if fewer than 10.
 */
function extractPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Sanitizes input text to prevent PostgREST operator injection or invalid wildcard patterns.
 */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_(),]/g, "").trim();
}

/**
 * Resolves email and phone values from explicit fields or generic sender string.
 */
function resolveSenderIdentifiers(input: MatchCustomerInput): {
  email: string | null;
  phone: string | null;
} {
  let email = input.senderEmail?.trim() || null;
  let phone = input.senderPhone?.trim() || null;

  if (input.sender) {
    const rawSender = input.sender.trim();
    if (!email && rawSender.includes("@")) {
      email = rawSender;
    } else if (!phone && !rawSender.includes("@") && /\d/.test(rawSender)) {
      phone = rawSender;
    }
  }

  return { email, phone };
}

/**
 * Pure in-memory matcher for customer resolution:
 * 1. Matches sender email against contacts.
 * 2. Matches sender phone (last 10 digits) against contacts.
 * 3. Matches customer hint against customer names (case-insensitive substring contains).
 * Returns the matching customer ID or null.
 */
export function matchCustomerInMemory(
  input: MatchCustomerInput,
  data: {
    contacts: Array<{ customer_id: string; email: string | null; mobile: string | null }>;
    customers: Array<{ id: string; name: string }>;
  }
): string | null {
  const { email, phone } = resolveSenderIdentifiers(input);

  // 1. Match by email in customer_contacts
  if (email) {
    const targetEmail = email.toLowerCase();
    const contact = data.contacts.find(
      (c) => c.email && c.email.trim().toLowerCase() === targetEmail
    );
    if (contact?.customer_id) {
      return contact.customer_id;
    }
  }

  // 2. Match by phone in customer_contacts
  if (phone) {
    const targetDigits = extractPhoneDigits(phone);
    if (targetDigits.length >= 7) {
      const contact = data.contacts.find((c) => {
        if (!c.mobile) return false;
        const contactDigits = extractPhoneDigits(c.mobile);
        return contactDigits.includes(targetDigits) || targetDigits.includes(contactDigits);
      });
      if (contact?.customer_id) {
        return contact.customer_id;
      }
    }
  }

  // 3. Match customer hint against customer name (case-insensitive contains)
  if (input.customerHint) {
    const hint = input.customerHint.trim().toLowerCase();
    if (hint.length > 0) {
      const customer = data.customers.find((c) =>
        c.name.toLowerCase().includes(hint)
      );
      if (customer?.id) {
        return customer.id;
      }
    }
  }

  return null;
}

/**
 * Matches an incoming enquiry's sender (email or phone) against `customer_contacts`,
 * then falls back to matching `customerHint` against `customers.name` (case-insensitive contains).
 * Returns the matched customer ID or null if no match is found.
 */
export async function matchCustomer(
  supabase: SupabaseClient<Database>,
  input: MatchCustomerInput
): Promise<string | null> {
  const { email, phone } = resolveSenderIdentifiers(input);

  // Step 1a: Check contact by email
  if (email) {
    const cleanEmail = sanitizeSearchTerm(email);
    if (cleanEmail.length > 0) {
      const { data: contact } = await supabase
        .from("customer_contacts")
        .select("customer_id")
        .ilike("email", cleanEmail)
        .limit(1)
        .maybeSingle();

      if (contact?.customer_id) {
        return contact.customer_id;
      }
    }
  }

  // Step 1b: Check contact by phone
  if (phone) {
    const digits = extractPhoneDigits(phone);
    if (digits.length >= 7) {
      const { data: contact } = await supabase
        .from("customer_contacts")
        .select("customer_id")
        .ilike("mobile", `%${digits}%`)
        .limit(1)
        .maybeSingle();

      if (contact?.customer_id) {
        return contact.customer_id;
      }
    }
  }

  // Step 2: Check customer hint against customer names (case-insensitive contains)
  if (input.customerHint) {
    const cleanHint = sanitizeSearchTerm(input.customerHint);
    if (cleanHint.length > 0) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .ilike("name", `%${cleanHint}%`)
        .order("name")
        .limit(1)
        .maybeSingle();

      if (customer?.id) {
        return customer.id;
      }
    }
  }

  return null;
}
