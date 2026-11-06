import { describe, expect, it } from "vitest";
import {
  buildQuotationStoragePath,
  calculateQuotationTotal,
  isValidQuotationStoragePath,
  MAX_QUOTATION_FILE_BYTES,
  prefillJobDefaultsFromQuotation,
  quotationFileName,
  quotationStatusDisplay,
  validateQuotationFile,
} from "./upload";

describe("quotation file upload validation (T30)", () => {
  it("accepts PDF and Word (.doc, .docx) files up to 6 MB", () => {
    expect(validateQuotationFile({ name: "QT-027-2026.pdf", size: 250_000, type: "application/pdf" })).toEqual({
      ok: true,
      extension: ".pdf",
      contentType: "application/pdf",
    });

    expect(
      validateQuotationFile({
        name: "Demo-Quotation.docx",
        size: MAX_QUOTATION_FILE_BYTES,
        type: "application/octet-stream",
      }),
    ).toEqual({
      ok: true,
      extension: ".docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(validateQuotationFile({ name: "Legacy-Quote.DOC", size: 1024 })).toEqual({
      ok: true,
      extension: ".doc",
      contentType: "application/msword",
    });
  });

  it("rejects empty files, files over 6 MB, and unsupported formats", () => {
    expect(validateQuotationFile({ name: "empty.pdf", size: 0 })).toEqual({
      ok: false,
      error: "Please choose a quotation file to upload.",
    });

    expect(validateQuotationFile({ name: "huge.pdf", size: MAX_QUOTATION_FILE_BYTES + 1 })).toEqual({
      ok: false,
      error: "The quotation file must be 6 MB or smaller.",
    });

    expect(validateQuotationFile({ name: "script.exe", size: 4096, type: "application/x-msdownload" })).toEqual({
      ok: false,
      error: "Only PDF (.pdf) or Word (.doc, .docx) quotation files are allowed.",
    });
  });

  it("builds and validates quotations/<quotation id>/<file> paths", () => {
    const qId = "50000000-0000-0000-0000-000000000001";
    const path = buildQuotationStoragePath(qId, "BITA Quote #027 (2026).docx", 1762430000000);
    expect(path).toBe(`quotations/${qId}/1762430000000-BITA_Quote_027_2026_.docx`);
    expect(isValidQuotationStoragePath(qId, path)).toBe(true);
    expect(quotationFileName(path)).toBe("BITA_Quote_027_2026_.docx");

    expect(isValidQuotationStoragePath(qId, `quotations/other-id/file.pdf`)).toBe(false);
    expect(isValidQuotationStoragePath(qId, `quotations/${qId}/../secret.pdf`)).toBe(false);
  });
});

describe("quotation total, status display, and job prefill (T30)", () => {
  it("calculates quotation total from item rates and minimum charges", () => {
    expect(
      calculateQuotationTotal([
        { rate: 3500, minimum_charge: 5500 },
        { rate: 2000, minimum_charge: null },
        { rate: null, minimum_charge: 1500 },
      ]),
    ).toBe(7000);
  });

  it("maps status workflow including Sent, Accepted, Rejected, and Superseded", () => {
    expect(quotationStatusDisplay({ status: "draft" })).toEqual({
      label: "Draft",
      tone: "wait",
      isRejected: false,
    });
    expect(quotationStatusDisplay({ status: "sent" })).toEqual({
      label: "Sent to customer",
      tone: "info",
      isRejected: false,
    });
    expect(quotationStatusDisplay({ status: "accepted" })).toEqual({
      label: "Accepted by customer",
      tone: "ok",
      isRejected: false,
    });
    expect(quotationStatusDisplay({ status: "superseded", superseded_by: null })).toEqual({
      label: "Rejected",
      tone: "bad",
      isRejected: true,
    });
    expect(
      quotationStatusDisplay({ status: "superseded", superseded_by: "50000000-0000-0000-0000-000000000002" }),
    ).toEqual({
      label: "Superseded",
      tone: "none",
      isRejected: false,
    });
  });

  it("prefills Create job defaults from an accepted quotation and its enquiry", () => {
    const defaults = prefillJobDefaultsFromQuotation({
      quotation: {
        id: "qt-1",
        customer_id: "cust-1",
        enquiry_id: "enq-1",
        subject: "UT and MPT of Rotor Shafts",
        quotation_items: [
          { description: "Ultrasonic testing of rotor shafts", rate: 4500 },
          { description: "Magnetic particle testing of journal ends", rate: 2500 },
        ],
      },
      enquiry: {
        id: "enq-1",
        customer_id: "cust-1",
        subject: "Enquiry for Rotor Shaft NDT",
        extracted: {
          site: "Peenya Stage II Works",
          test_methods: ["UT", "MPT", "INVALID"],
        },
      },
      validMethods: ["UT", "MPT", "DPT", "RT", "VT"],
    });

    expect(defaults).toEqual({
      customer_id: "cust-1",
      enquiry_id: "enq-1",
      quotation_id: "qt-1",
      scope:
        "UT and MPT of Rotor Shafts — Ultrasonic testing of rotor shafts; Magnetic particle testing of journal ends",
      site: "Peenya Stage II Works",
      test_methods: ["UT", "MPT"],
    });
  });
});
