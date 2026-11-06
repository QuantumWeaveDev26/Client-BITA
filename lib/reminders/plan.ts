import { todayIST } from "../dates";
import type { Database } from "../db/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getReminderKindForInvoice,
  type InvoiceReminderCandidate,
  type ReminderKind,
} from "./schedule";
import {
  resolveReminderMailbox,
  resolveReminderRecipients,
  type ReminderContact,
  type ReminderCustomer,
} from "./sender";

export interface InvoiceForPlanning extends InvoiceReminderCandidate {
  id: string;
  customer?: ReminderCustomer | null;
  contacts?: ReminderContact[] | null;
}

export interface ExistingReminderKey {
  invoice_id: string;
  scheduled_for: string;
}

export interface PlannedPaymentReminder {
  invoice_id: string;
  scheduled_for: string;
  kind: ReminderKind;
  from_mailbox: string | null;
  sent_to: string[];
}

/**
 * Type guard to check if an object is already a normalized InvoiceForPlanning.
 */
export function isInvoiceForPlanning(obj: unknown): obj is InvoiceForPlanning {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    typeof (obj as { id?: unknown }).id === "string" &&
    !("jobs" in obj) &&
    !("job" in obj)
  );
}

/**
 * Normalizes database invoice rows that may have nested job -> customer -> contacts joins.
 */
export function normalizeInvoiceForPlanning(
  raw: Record<string, unknown>,
): InvoiceForPlanning {
  const job = (raw.jobs || raw.job) as Record<string, unknown> | undefined;
  const customer = (raw.customers || raw.customer || job?.customers || job?.customer) as
    | Record<string, unknown>
    | undefined;

  const rawContacts =
    raw.customer_contacts ||
    raw.contacts ||
    customer?.customer_contacts ||
    customer?.contacts;

  const contacts: ReminderContact[] = Array.isArray(rawContacts)
    ? rawContacts.map((c: unknown) => {
        const contactObj = typeof c === "object" && c !== null ? (c as Record<string, unknown>) : {};
        return {
          email: typeof contactObj.email === "string" ? contactObj.email : null,
          receives_invoices: Boolean(contactObj.receives_invoices),
        };
      })
    : [];

  return {
    id: String(raw.id),
    due_date: typeof raw.due_date === "string" ? raw.due_date : null,
    balance:
      raw.balance !== null && raw.balance !== undefined
        ? Number(raw.balance)
        : null,
    reminders_paused: Boolean(raw.reminders_paused),
    customer: customer
      ? {
          mailbox: typeof customer.mailbox === "string" ? customer.mailbox : null,
        }
      : null,
    contacts,
  };
}

/**
 * Builds the list of payment_reminders records due on the given day (default: today in IST).
 * Skips invoices that:
 * - Have no reminder due on this date (based on schedule rules)
 * - Already have a reminder in the table for (invoice_id, scheduled_for)
 */
export function planPaymentReminders(
  invoices: Array<InvoiceForPlanning | Record<string, unknown>>,
  existingReminders: ExistingReminderKey[] | Set<string> = [],
  today: string = todayIST(),
): PlannedPaymentReminder[] {
  const existingSet =
    existingReminders instanceof Set
      ? existingReminders
      : new Set(
          existingReminders.map(
            (r) => `${r.invoice_id}:${r.scheduled_for}`,
          ),
        );

  const planned: PlannedPaymentReminder[] = [];

  for (const raw of invoices) {
    const inv: InvoiceForPlanning = isInvoiceForPlanning(raw)
      ? raw
      : normalizeInvoiceForPlanning(raw as Record<string, unknown>);

    const kind = getReminderKindForInvoice(inv, today);
    if (!kind) {
      continue;
    }

    const key = `${inv.id}:${today}`;
    if (existingSet.has(key)) {
      continue;
    }

    const from_mailbox = resolveReminderMailbox(inv.customer);
    const sent_to = resolveReminderRecipients(inv.contacts);

    planned.push({
      invoice_id: inv.id,
      scheduled_for: today,
      kind,
      from_mailbox,
      sent_to,
    });
  }

  return planned;
}

/**
 * Fetches eligible invoices from Supabase, calculates reminders due on targetDate,
 * checks existing reminders to prevent duplicates, and inserts the planned rows.
 * Does NOT send emails (sending waits for Stage 2).
 */
export async function planAndInsertReminders(
  supabase: SupabaseClient<Database>,
  targetDate: string = todayIST(),
): Promise<{
  scheduled_for: string;
  total_invoices_scanned: number;
  planned_count: number;
  inserted_count: number;
  records: PlannedPaymentReminder[];
}> {
  // 1. Fetch invoices with balance > 0, unpaused, due_date set
  const { data: invoices, error: invError } = await supabase
    .from("invoices")
    .select("id, job_id, due_date, balance, reminders_paused")
    .gt("balance", 0)
    .eq("reminders_paused", false)
    .not("due_date", "is", null);

  if (invError) {
    throw new Error(`Failed to fetch invoices: ${invError.message}`);
  }

  const invoiceList = invoices ?? [];

  // Filter to invoices that match today's reminder schedule
  const candidates = invoiceList.filter((inv) =>
    Boolean(getReminderKindForInvoice(inv, targetDate)),
  );

  if (candidates.length === 0) {
    return {
      scheduled_for: targetDate,
      total_invoices_scanned: invoiceList.length,
      planned_count: 0,
      inserted_count: 0,
      records: [],
    };
  }

  // 2. Fetch existing reminders for this target date
  const candidateIds = candidates.map((c) => c.id);
  const { data: existing, error: existError } = await supabase
    .from("payment_reminders")
    .select("invoice_id, scheduled_for")
    .eq("scheduled_for", targetDate)
    .in("invoice_id", candidateIds);

  if (existError) {
    throw new Error(`Failed to check existing reminders: ${existError.message}`);
  }

  const existingKeys = new Set(
    (existing ?? []).map((e) => `${e.invoice_id}:${e.scheduled_for}`),
  );

  // Invoices still needing planning
  const needingPlanning = candidates.filter(
    (c) => !existingKeys.has(`${c.id}:${targetDate}`),
  );

  if (needingPlanning.length === 0) {
    return {
      scheduled_for: targetDate,
      total_invoices_scanned: invoiceList.length,
      planned_count: 0,
      inserted_count: 0,
      records: [],
    };
  }

  // 3. Resolve customer mailbox and contacts with receives_invoices for needingPlanning
  const jobIds = Array.from(new Set(needingPlanning.map((c) => c.job_id)));
  const { data: jobs, error: jobError } = await supabase
    .from("jobs")
    .select("id, customer_id")
    .in("id", jobIds);

  if (jobError) {
    throw new Error(`Failed to fetch jobs for invoices: ${jobError.message}`);
  }

  const customerIdByJob = new Map<string, string>();
  for (const j of jobs ?? []) {
    customerIdByJob.set(j.id, j.customer_id);
  }

  const customerIds = Array.from(new Set(Array.from(customerIdByJob.values())));

  const [custRes, contactsRes] = await Promise.all([
    supabase.from("customers").select("id, mailbox").in("id", customerIds),
    supabase
      .from("customer_contacts")
      .select("customer_id, email, receives_invoices")
      .in("customer_id", customerIds)
      .eq("receives_invoices", true),
  ]);

  if (custRes.error) {
    throw new Error(`Failed to fetch customers: ${custRes.error.message}`);
  }
  if (contactsRes.error) {
    throw new Error(`Failed to fetch customer contacts: ${contactsRes.error.message}`);
  }

  const customerMap = new Map<string, { mailbox: string | null }>();
  for (const c of custRes.data ?? []) {
    customerMap.set(c.id, { mailbox: c.mailbox });
  }

  const contactsMap = new Map<string, Array<{ email: string | null; receives_invoices: boolean }>>();
  for (const ct of contactsRes.data ?? []) {
    const list = contactsMap.get(ct.customer_id) ?? [];
    list.push({ email: ct.email, receives_invoices: ct.receives_invoices });
    contactsMap.set(ct.customer_id, list);
  }

  const fullInvoices: InvoiceForPlanning[] = needingPlanning.map((inv) => {
    const customerId = customerIdByJob.get(inv.job_id);
    const customer = customerId ? customerMap.get(customerId) ?? null : null;
    const contacts = customerId ? contactsMap.get(customerId) ?? [] : [];
    return {
      id: inv.id,
      due_date: inv.due_date,
      balance: inv.balance,
      reminders_paused: inv.reminders_paused,
      customer,
      contacts,
    };
  });

  const planned = planPaymentReminders(fullInvoices, existingKeys, targetDate);

  let insertedCount = 0;
  if (planned.length > 0) {
    const { error: insertError } = await supabase
      .from("payment_reminders")
      .insert(
        planned.map((p) => ({
          invoice_id: p.invoice_id,
          scheduled_for: p.scheduled_for,
          kind: p.kind,
          from_mailbox: p.from_mailbox,
          sent_to: p.sent_to,
        })),
      );

    if (insertError) {
      throw new Error(`Failed to insert payment reminders: ${insertError.message}`);
    }
    insertedCount = planned.length;
  }

  return {
    scheduled_for: targetDate,
    total_invoices_scanned: invoiceList.length,
    planned_count: planned.length,
    inserted_count: insertedCount,
    records: planned,
  };
}
