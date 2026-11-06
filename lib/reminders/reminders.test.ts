import { describe, expect, it } from "vitest";
import {
  getReminderKindForInvoice,
  type InvoiceReminderCandidate,
} from "./schedule";
import {
  resolveReminderMailbox,
  resolveReminderRecipients,
  type ReminderContact,
  type ReminderCustomer,
} from "./sender";
import {
  normalizeInvoiceForPlanning,
  planPaymentReminders,
} from "./plan";

describe("Payment Reminders Schedule (lib/reminders/schedule.ts)", () => {
  const baseInvoice: InvoiceReminderCandidate = {
    due_date: "2026-11-10",
    balance: 50000,
    reminders_paused: false,
  };

  it("returns null for dates more than 2 days before the due date", () => {
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-06")).toBeNull();
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-07")).toBeNull();
  });

  it("returns 'before_due' exactly 2 days before the due date", () => {
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-08")).toBe("before_due");
  });

  it("returns null exactly 1 day before the due date (no reminder)", () => {
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-09")).toBeNull();
  });

  it("returns 'on_due' on the due date", () => {
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-10")).toBe("on_due");
  });

  it("returns null for days 1 through 4 after the due date (quiet buffer)", () => {
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-11")).toBeNull(); // Day +1
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-12")).toBeNull(); // Day +2
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-13")).toBeNull(); // Day +3
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-14")).toBeNull(); // Day +4
  });

  it("returns 'overdue' daily starting from the 5th day after due date onwards", () => {
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-15")).toBe("overdue"); // Day +5
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-16")).toBe("overdue"); // Day +6
    expect(getReminderKindForInvoice(baseInvoice, "2026-11-20")).toBe("overdue"); // Day +10
    expect(getReminderKindForInvoice(baseInvoice, "2026-12-10")).toBe("overdue"); // Day +30
  });

  it("returns null if the balance is 0 or negative (paid in full)", () => {
    expect(
      getReminderKindForInvoice({ ...baseInvoice, balance: 0 }, "2026-11-10"),
    ).toBeNull();
    expect(
      getReminderKindForInvoice({ ...baseInvoice, balance: -100 }, "2026-11-15"),
    ).toBeNull();
    expect(
      getReminderKindForInvoice({ ...baseInvoice, balance: null }, "2026-11-10"),
    ).toBeNull();
  });

  it("returns null if reminders_paused is true, even on due or overdue dates", () => {
    expect(
      getReminderKindForInvoice(
        { ...baseInvoice, reminders_paused: true },
        "2026-11-08",
      ),
    ).toBeNull();
    expect(
      getReminderKindForInvoice(
        { ...baseInvoice, reminders_paused: true },
        "2026-11-10",
      ),
    ).toBeNull();
    expect(
      getReminderKindForInvoice(
        { ...baseInvoice, reminders_paused: true },
        "2026-11-16",
      ),
    ).toBeNull();
  });

  it("returns null if due_date is null or missing", () => {
    expect(
      getReminderKindForInvoice({ ...baseInvoice, due_date: null }, "2026-11-10"),
    ).toBeNull();
    expect(
      getReminderKindForInvoice({ ...baseInvoice, due_date: "" }, "2026-11-10"),
    ).toBeNull();
  });
});

describe("Payment Reminders Sender (lib/reminders/sender.ts)", () => {
  it("resolves the 'from' mailbox from the customer's mailbox column (TDPS rule)", () => {
    const tdpsCustomer: ReminderCustomer = { mailbox: "tdps-desk@bita.example" };
    expect(resolveReminderMailbox(tdpsCustomer)).toBe("tdps-desk@bita.example");

    const defaultCustomer: ReminderCustomer = { mailbox: null };
    expect(resolveReminderMailbox(defaultCustomer)).toBeNull();

    expect(resolveReminderMailbox(null)).toBeNull();
  });

  it("resolves recipient emails from contacts with receives_invoices = true only", () => {
    const contacts: ReminderContact[] = [
      { email: "accounts@fakeclient.com", receives_invoices: true },
      { email: "finance@fakeclient.com", receives_invoices: true },
      { email: "site-engineer@fakeclient.com", receives_invoices: false },
      { email: null, receives_invoices: true },
      { email: "accounts@fakeclient.com", receives_invoices: true }, // Duplicate
    ];

    const recipients = resolveReminderRecipients(contacts);
    expect(recipients).toEqual([
      "accounts@fakeclient.com",
      "finance@fakeclient.com",
    ]);
  });

  it("handles empty or missing contact lists gracefully", () => {
    expect(resolveReminderRecipients([])).toEqual([]);
    expect(resolveReminderRecipients(null)).toEqual([]);
    expect(resolveReminderRecipients(undefined)).toEqual([]);
  });
});

describe("Payment Reminders Plan (lib/reminders/plan.ts)", () => {
  const targetDate = "2026-11-10";

  const sampleInvoices = [
    {
      id: "inv-before-due",
      due_date: "2026-11-12", // 2 days after targetDate -> targetDate is 2 days before
      balance: 10000,
      reminders_paused: false,
      customer: { mailbox: "client-a@bita.example" },
      contacts: [{ email: "pay@client-a.com", receives_invoices: true }],
    },
    {
      id: "inv-on-due",
      due_date: "2026-11-10", // Exactly on targetDate
      balance: 25000,
      reminders_paused: false,
      customer: { mailbox: "tdps-desk@bita.example" },
      contacts: [{ email: "finance@tdps.example", receives_invoices: true }],
    },
    {
      id: "inv-overdue",
      due_date: "2026-11-05", // 5 days before targetDate -> overdue
      balance: 40000,
      reminders_paused: false,
      customer: { mailbox: null },
      contacts: [{ email: "billing@client-c.com", receives_invoices: true }],
    },
    {
      id: "inv-quiet-buffer",
      due_date: "2026-11-08", // 2 days overdue -> quiet buffer, no reminder
      balance: 15000,
      reminders_paused: false,
    },
    {
      id: "inv-already-planned",
      due_date: "2026-11-10",
      balance: 30000,
      reminders_paused: false,
      customer: { mailbox: null },
      contacts: [{ email: "ap@client-d.com", receives_invoices: true }],
    },
    {
      id: "inv-paid",
      due_date: "2026-11-10",
      balance: 0,
      reminders_paused: false,
    },
    {
      id: "inv-paused",
      due_date: "2026-11-10",
      balance: 50000,
      reminders_paused: true,
    },
  ];

  it("plans reminders for eligible invoices and skips ineligible or existing rows", () => {
    const existing = [
      { invoice_id: "inv-already-planned", scheduled_for: targetDate },
    ];

    const planned = planPaymentReminders(sampleInvoices, existing, targetDate);

    expect(planned).toHaveLength(3);

    // 1. Before due
    expect(planned.find((p) => p.invoice_id === "inv-before-due")).toEqual({
      invoice_id: "inv-before-due",
      scheduled_for: targetDate,
      kind: "before_due",
      from_mailbox: "client-a@bita.example",
      sent_to: ["pay@client-a.com"],
    });

    // 2. On due (TDPS mailbox verified)
    expect(planned.find((p) => p.invoice_id === "inv-on-due")).toEqual({
      invoice_id: "inv-on-due",
      scheduled_for: targetDate,
      kind: "on_due",
      from_mailbox: "tdps-desk@bita.example",
      sent_to: ["finance@tdps.example"],
    });

    // 3. Overdue
    expect(planned.find((p) => p.invoice_id === "inv-overdue")).toEqual({
      invoice_id: "inv-overdue",
      scheduled_for: targetDate,
      kind: "overdue",
      from_mailbox: null,
      sent_to: ["billing@client-c.com"],
    });

    // 4. inv-already-planned was skipped
    expect(planned.find((p) => p.invoice_id === "inv-already-planned")).toBeUndefined();
  });

  it("normalizes joined database rows correctly", () => {
    const rawJoin = {
      id: "raw-inv-1",
      due_date: "2026-11-10",
      balance: "12500.50",
      reminders_paused: false,
      jobs: {
        customer: {
          mailbox: "accounts-mailbox@bita.example",
          customer_contacts: [
            { email: "c1@test.com", receives_invoices: true },
            { email: "c2@test.com", receives_invoices: false },
          ],
        },
      },
    };

    const normalized = normalizeInvoiceForPlanning(rawJoin);
    expect(normalized.id).toBe("raw-inv-1");
    expect(normalized.balance).toBe(12500.5);
    expect(normalized.customer?.mailbox).toBe("accounts-mailbox@bita.example");
    expect(normalized.contacts).toHaveLength(2);
  });
});
