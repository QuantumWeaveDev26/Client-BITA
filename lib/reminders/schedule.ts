import { daysBetween, todayIST } from "../dates";

export type ReminderKind = "before_due" | "on_due" | "overdue";

export interface InvoiceReminderCandidate {
  due_date?: string | null;
  balance?: number | string | null;
  reminders_paused?: boolean | null;
}

/**
 * Returns which reminder is due today for a given invoice according to BITA's business rule:
 * - 2 days before the due date: "before_due"
 * - On the due date: "on_due"
 * - 1 to 4 days after the due date: no reminder (null)
 * - 5th day after the due date and daily thereafter: "overdue" until paid
 *
 * Returns null if:
 * - balance is 0 or negative or missing
 * - reminders are paused
 * - due_date is missing or invalid
 * - today does not match one of the scheduled reminder intervals
 */
export function getReminderKindForInvoice(
  invoice: InvoiceReminderCandidate,
  today: string = todayIST(),
): ReminderKind | null {
  if (invoice.reminders_paused) {
    return null;
  }

  const rawBalance = invoice.balance;
  if (rawBalance === null || rawBalance === undefined) {
    return null;
  }
  const numericBalance = Number(rawBalance);
  if (isNaN(numericBalance) || numericBalance <= 0) {
    return null;
  }

  if (!invoice.due_date || typeof invoice.due_date !== "string") {
    return null;
  }

  const daysDiff = daysBetween(invoice.due_date, today);

  if (daysDiff === -2) {
    return "before_due";
  }

  if (daysDiff === 0) {
    return "on_due";
  }

  if (daysDiff >= 5) {
    return "overdue";
  }

  return null;
}
