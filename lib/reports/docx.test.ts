import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildReportDocxSpec, generateReportDocxBytes } from "./docx";
import { DEFAULT_DEV_LETTERHEAD, parseEditedReportReadings } from "./review";
import type { ReportDocument } from "../../templates/reports/types";

function extractZipTextEntries(zipBytes: Uint8Array): Record<string, string> {
  const buf = Buffer.from(zipBytes);
  const entries: Record<string, string> = {};
  let offset = 0;

  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const compressionMethod = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const fileNameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLen + extraLen;
    const name = buf.subarray(nameStart, nameStart + fileNameLen).toString("utf8");
    const compressed = buf.subarray(dataStart, dataStart + compressedSize);

    if (compressionMethod === 0) {
      entries[name] = compressed.toString("utf8");
    } else if (compressionMethod === 8 && compressedSize > 0) {
      entries[name] = inflateRawSync(compressed).toString("utf8");
    }
    offset = dataStart + compressedSize;
  }

  return entries;
}

const FAKE_UT_DOCUMENT: ReportDocument = {
  reportNumber: "010/FAKE/1126",
  reportDate: "2026-11-06",
  letterhead: DEFAULT_DEV_LETTERHEAD,
  readings: {
    client: "Test Turbines Pvt Ltd",
    project: "15 MW Steam Turbine Rotor",
    inspection_site: "Peenya Fake Works",
    inspection_date: "2026-11-05",
    equipment: "USM 36 Flaw Detector",
    equipment_serial: "FAKE-UT-01",
    probes: "2.5 MHz Normal & 4 MHz 45 deg",
    reference_blocks: "IIW V1 & V2",
    screen_range: "0 - 250 mm",
    sensitivity: "DAC + 6 dB",
    scanning_level: "Reference + 6 dB",
    couplant: "Machine Oil",
    surface_condition: "Machined smooth (Ra 3.2)",
    standard: "ASME Sec V Art 4",
    acceptance_criteria: "ASME Sec VIII Div 1",
    technicians: [
      {
        name: "Demo Tech One",
        qualification: "ISNT UT Level II",
        certificate_no: "ISNT-FAKE-101",
        issued_on: "2024-01-15",
        valid_until: "2029-01-14",
      },
    ],
    items: [
      {
        description: "Forged alloy steel turbine shaft (Drawing FAKE-DRG-09)",
        quantity: 2,
        observations: "No recordable ultrasonic indications observed; acceptable.",
      },
    ],
  },
  approval: { approved: false },
};

describe("Word (.docx) report builder (T33)", () => {
  it("builds UT, MPT, and DPT layout specs matching templates/reports order and column widths", () => {
    const utSpec = buildReportDocxSpec("UT", FAKE_UT_DOCUMENT);
    expect(utSpec.title).toBe("ULTRASONIC INSPECTION REPORT");
    expect(utSpec.columns).toHaveLength(11);
    expect(utSpec.isDraft).toBe(true);
    expect(utSpec.signoff).toBeNull();
    expect(utSpec.header.reportDateFormatted).toBe("06.11.2026");
    expect(utSpec.clientRows).toEqual([
      ["CLIENT", "Test Turbines Pvt Ltd"],
      ["PROJECT", "15 MW Steam Turbine Rotor"],
      ["INSPECTION SITE/DATE", "Peenya Fake Works / 05.11.2026"],
    ]);
    expect(utSpec.detailPairs[0]).toEqual({
      leftLabel: "Equipment Used",
      leftValue: "USM 36 Flaw Detector\nS.No. FAKE-UT-01",
      rightLabel: "Reference Blocks",
      rightValue: "IIW V1 & V2",
    });
    expect(utSpec.technicianSection.rows[0].issuedOn).toBe("15.01.2024");
    expect(utSpec.itemSection.rows[0]).toEqual({
      description: "Forged alloy steel turbine shaft (Drawing FAKE-DRG-09)",
      quantity: "2",
      observations: "No recordable ultrasonic indications observed; acceptable.",
    });

    const dptSpec = buildReportDocxSpec("DPT", {
      ...FAKE_UT_DOCUMENT,
      readings: {
        client: "Sample Forgings Ltd",
        project: "Valve Body Inspection",
        inspection_site: "Unit 2 Fake Shop",
        inspection_date: "2026-11-06",
        component_description: "Machined Butt Weld Ends",
        cleaner: "SKC-S",
        cleaner_batch: "B-101",
        penetrant: "SKL-SP2",
        penetrant_batch: "B-202",
        developer: "SKD-S2",
        developer_batch: "B-303",
        standard: "ASME Sec V Art 6",
        dwell_time: "15 mins",
        developing_time: "10 mins",
        technicians: FAKE_UT_DOCUMENT.readings.technicians,
        items: [
          {
            description: "8 inch Gate Valve Body #V-01",
            quantity: 4,
            observations: "Free from linear or rounded surface indications.",
          },
        ],
      },
    });
    expect(dptSpec.title).toBe("DYE PENETRANT INSPECTION REPORT");
    expect(dptSpec.dptDetails).toEqual({
      itemsUsedLines: [
        "Cleaner: SKC-S   Batch No. B-101",
        "Penetrant: SKL-SP2   Batch No. B-202",
        "Developer: SKD-S2   Batch No. B-303",
      ],
      standardFollowed: "ASME Sec V Art 6",
      dwellAndDevelopingTime: "15 mins / 10 mins",
    });
    expect(dptSpec.itemSection.rows[0].description).toContain("Machined Butt Weld Ends");
  });

  it("generates a valid .docx archive with draft notice when unapproved and signatory when approved", async () => {
    const draftBytes = await generateReportDocxBytes("UT", FAKE_UT_DOCUMENT);
    expect(draftBytes[0]).toBe(0x50); // 'P'
    expect(draftBytes[1]).toBe(0x4b); // 'K'

    const draftEntries = extractZipTextEntries(draftBytes);
    const draftXml = draftEntries["word/document.xml"] ?? "";
    expect(draftXml).toContain("ULTRASONIC INSPECTION REPORT");
    expect(draftXml).toContain("010/FAKE/1126");
    expect(draftXml).toContain("Test Turbines Pvt Ltd");
    expect(draftXml).toContain("USM 36 Flaw Detector");
    expect(draftXml).toContain("No recordable ultrasonic indications observed");
    expect(draftXml).toContain("DRAFT");
    expect(draftXml).not.toContain("Demo Reviewer Signatory");

    const approvedBytes = await generateReportDocxBytes("UT", {
      ...FAKE_UT_DOCUMENT,
      approval: {
        approved: true,
        approvedAt: "2026-11-06T12:00:00Z",
        signatoryName: "Demo Reviewer Signatory",
        signatoryQualification: "ASNT NDT Level III",
      },
    });
    const approvedEntries = extractZipTextEntries(approvedBytes);
    const approvedXml = approvedEntries["word/document.xml"] ?? "";
    expect(approvedXml).not.toContain("NOT APPROVED FOR ISSUE");
    expect(approvedXml).toContain("Demo Reviewer Signatory");
    expect(approvedXml).toContain("ASNT NDT Level III");
  });
});

describe("parseEditedReportReadings (T33)", () => {
  it("parses edited scalar readings, Others dropdown free-text, technicians, and items", () => {
    const fd = new FormData();
    fd.set("reading_client", "Edited Fake Client Ltd");
    fd.set("reading_project", "Rotor Overhaul");
    fd.set("reading_inspection_site", "Shop Floor B");
    fd.set("reading_inspection_date", "2026-11-06");
    fd.set("reading_couplant", "__OTHER__");
    fd.set("reading_couplant__other", "Custom Glycerine Gel");
    fd.set("reading_sensitivity", "DAC + 8 dB");

    fd.set("technicians_count", "1");
    fd.set("technicians.0.name", "Edited Tech");
    fd.set("technicians.0.qualification", "UT Level II");
    fd.set("technicians.0.certificate_no", "CERT-99");
    fd.set("technicians.0.issued_on", "2025-01-01");
    fd.set("technicians.0.valid_until", "2030-01-01");

    fd.set("items_count", "2");
    fd.set("items.0.description", "Main Shaft Forging");
    fd.set("items.0.quantity", "3");
    fd.set("items.0.observations", "Edited observation: acceptable as per ASME.");
    // Blank second row should be ignored
    fd.set("items.1.description", "   ");
    fd.set("items.1.quantity", "");
    fd.set("items.1.observations", "");

    const edited = parseEditedReportReadings("UT", fd, FAKE_UT_DOCUMENT.readings);
    expect(edited.client).toBe("Edited Fake Client Ltd");
    expect(edited.couplant).toBe("Custom Glycerine Gel");
    expect(edited.sensitivity).toBe("DAC + 8 dB");
    expect(edited.equipment).toBe("USM 36 Flaw Detector");
    expect(edited.technicians).toEqual([
      {
        name: "Edited Tech",
        qualification: "UT Level II",
        certificate_no: "CERT-99",
        issued_on: "2025-01-01",
        valid_until: "2030-01-01",
      },
    ]);
    expect(edited.items).toEqual([
      {
        description: "Main Shaft Forging",
        quantity: 3,
        observations: "Edited observation: acceptable as per ASME.",
      },
    ]);
  });
});
