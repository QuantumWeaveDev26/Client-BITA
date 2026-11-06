export interface ReminderCustomer {
  mailbox?: string | null;
}

export interface ReminderContact {
  email?: string | null;
  receives_invoices?: boolean | null;
}

/**
 * Resolves the sender mailbox from the customer record.
 * TDPS and other dedicated accounts specify their own BITA mailbox in customers.mailbox.
 * Returns null if no mailbox is configured on the customer.
 */
export function resolveReminderMailbox(
  customer?: ReminderCustomer | null,
): string | null {
  if (!customer?.mailbox) {
    return null;
  }
  const mailbox = customer.mailbox.trim();
  return mailbox.length > 0 ? mailbox : null;
}

/**
 * Resolves recipient email addresses for an invoice payment reminder.
 * Looks up customer contacts flagged with receives_invoices = true.
 * Trims, lowercases, validates basic email shape, and deduplicates addresses.
 */
export function resolveReminderRecipients(
  contacts?: ReminderContact[] | null,
): string[] {
  if (!contacts || !Array.isArray(contacts)) {
    return [];
  }

  const seen = new Set<string>();
  for (const c of contacts) {
    if (c.receives_invoices && c.email) {
      const email = c.email.trim().toLowerCase();
      if (email.length > 0 && email.includes("@")) {
        seen.add(email);
      }
    }
  }

  return Array.from(seen);
}
