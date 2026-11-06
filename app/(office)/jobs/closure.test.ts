import { describe, expect, it } from "vitest";
import {
  classifyEquipmentAlert,
  classifyQualificationAlert,
  isJobReadyToClose,
  resolveEnquiryAttention,
} from "./closure";

describe("job closure and dashboard alert helpers (T20, T21, T22)", () => {
  it("identifies jobs ready to close only when report is sent and tax invoice balance is 0", () => {
    expect(
      isJobReadyToClose({
        status: "report_sent",
        reports: [{ status: "sent", sent_at: "2026-11-05T10:00:00Z" }],
        invoices: [{ kind: "tax_invoice", balance: 0 }],
      })
    ).toBe(true);

    expect(
      isJobReadyToClose({
        status: "invoiced",
        reports: [{ status: "sent", sent_at: "2026-11-05T10:00:00Z" }],
        invoices: [{ kind: "tax_invoice", balance: 17700 }],
      })
    ).toBe(false);

    expect(
      isJobReadyToClose({
        status: "report_in_review",
        reports: [{ status: "in_review", sent_at: null }],
        invoices: [],
      })
    ).toBe(false);

    expect(
      isJobReadyToClose({
        status: "closed",
        reports: [{ status: "sent", sent_at: "2026-11-05T10:00:00Z" }],
        invoices: [{ kind: "tax_invoice", balance: 0 }],
      })
    ).toBe(false);
  });

  it("flags expired and soon-expiring qualifications within 30 days", () => {
    const expired = classifyQualificationAlert(
      {
        id: "q1",
        method: "MPT",
        valid_until: "2026-09-30",
        is_expired: true,
        people: { full_name: "K. Fake Tech" },
      },
      "2026-11-06"
    );
    expect(expired?.tone).toBe("bad");
    expect(expired?.title).toContain("expired");

    const dueSoon = classifyQualificationAlert(
      {
        id: "q2",
        method: "UT",
        valid_until: "2026-11-20",
        is_expired: false,
        people: { full_name: "M. Sample Tech" },
      },
      "2026-11-06"
    );
    expect(dueSoon?.tone).toBe("wait");
    expect(dueSoon?.title).toContain("expires soon");

    const validFar = classifyQualificationAlert(
      {
        id: "q3",
        method: "UT",
        valid_until: "2027-06-30",
        is_expired: false,
        people: { full_name: "M. Sample Tech" },
      },
      "2026-11-06"
    );
    expect(validFar).toBeNull();
  });

  it("flags overdue and due-soon equipment calibration within 30 days", () => {
    const overdue = classifyEquipmentAlert(
      {
        id: "e1",
        make: "DemoMag",
        model: "Y-220",
        serial_no: "FAKE-YOKE-202",
        calibration_due: "2026-10-15",
      },
      "2026-11-06"
    );
    expect(overdue?.tone).toBe("bad");
    expect(overdue?.title).toContain("overdue");

    const dueSoon = classifyEquipmentAlert(
      {
        id: "e2",
        make: "TestSonic",
        model: "UT-900",
        serial_no: "FAKE-UT-103",
        calibration_due: "2026-11-20",
      },
      "2026-11-06"
    );
    expect(dueSoon?.tone).toBe("wait");
    expect(dueSoon?.title).toContain("due soon");
  });

  it("resolves attention for enquiry -> quotation from matching contact, sender name, or primary contact", () => {
    const contacts = [
      { name: "Primary Contact", email: "primary@example.test", mobile: "+91 90000 00001" },
      { name: "Sender Contact", email: "sender@example.test", mobile: "+91 90000 00002" },
    ];
    expect(
      resolveEnquiryAttention(
        { from_name: "Fallback Name", from_address: "SENDER@example.test" },
        contacts
      )
    ).toBe("Sender Contact");
    expect(
      resolveEnquiryAttention({ from_name: "Direct Sender", from_address: null }, contacts)
    ).toBe("Direct Sender");
    expect(resolveEnquiryAttention({ from_name: null, from_address: null }, contacts)).toBe(
      "Primary Contact"
    );
  });
});
