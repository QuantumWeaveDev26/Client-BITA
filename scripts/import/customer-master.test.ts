import { describe, expect, it, vi } from "vitest";
import {
  cleanCell,
  cleanEmail,
  cleanPhone,
  executeCustomerMasterImport,
  formatImportSummary,
  parseCustomerMaster,
} from "./customer-master";

// Helper to construct a minimal valid Excel .xlsx buffer entirely in memory for testing
function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (~crc) >>> 0;
}

function createFakeXlsxBuffer(rows: string[][]): Buffer {
  let sheetRowsXml = "";
  rows.forEach((row, rIdx) => {
    const rowNum = rIdx + 1;
    sheetRowsXml += `<row r="${rowNum}">`;
    row.forEach((cell, cIdx) => {
      const colLetter = String.fromCharCode(65 + cIdx);
      const cellRef = `${colLetter}${rowNum}`;
      sheetRowsXml += `<c r="${cellRef}" t="inlineStr"><is><t>${cell}</t></is></c>`;
    });
    sheetRowsXml += `</row>`;
  });

  const files = [
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    },
    {
      name: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    {
      name: "xl/workbook.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRowsXml}</sheetData></worksheet>`,
    },
  ];

  const fileEntries: Array<{ name: string; offset: number; length: number; crc: number }> = [];
  let offset = 0;
  const parts: Buffer[] = [];

  for (const f of files) {
    const data = Buffer.from(f.content, "utf8");
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8); // store
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(Buffer.byteLength(f.name), 26);
    header.writeUInt16LE(0, 28);
    parts.push(header, Buffer.from(f.name, "utf8"), data);
    fileEntries.push({ name: f.name, offset, length: data.length, crc });
    offset += 30 + Buffer.byteLength(f.name) + data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const f of fileEntries) {
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(f.crc, 16);
    cd.writeUInt32LE(f.length, 20);
    cd.writeUInt32LE(f.length, 24);
    cd.writeUInt16LE(Buffer.byteLength(f.name), 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(f.offset, 42);
    parts.push(cd, Buffer.from(f.name, "utf8"));
    cdSize += 46 + Buffer.byteLength(f.name);
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(fileEntries.length, 8);
  eocd.writeUInt16LE(fileEntries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);
  parts.push(eocd);

  return Buffer.concat(parts);
}

describe("Customer Master Import – Value Sanitization", () => {
  it("cleans empty and 'Not found in email' values", () => {
    expect(cleanCell(null)).toBeNull();
    expect(cleanCell("")).toBeNull();
    expect(cleanCell("   ")).toBeNull();
    expect(cleanCell("Not found in email")).toBeNull();
    expect(cleanCell("not found in email")).toBeNull();
    expect(cleanCell("NOT FOUND IN EMAIL")).toBeNull();
    expect(cleanCell("Not found")).toBeNull();
    expect(cleanCell("N/A")).toBeNull();
    expect(cleanCell("-")).toBeNull();
    expect(cleanCell("Valid Contact")).toBe("Valid Contact");
  });

  it("cleans phone numbers and handles numeric float artifacts", () => {
    expect(cleanPhone("9876543210.0")).toBe("9876543210");
    expect(cleanPhone("+91 98765 43210")).toBe("+91 98765 43210");
    expect(cleanPhone("Not found in email")).toBeNull();
  });

  it("cleans and lowercases emails", () => {
    expect(cleanEmail("JOHN.DOE@EXAMPLE.COM")).toBe("john.doe@example.com");
    expect(cleanEmail("not found in email")).toBeNull();
  });
});

describe("Customer Master Import – Excel Parsing & Grouping", () => {
  const fakeRows = [
    [
      "Company",
      "Contact Person",
      "Mobile Number",
      "Email Address",
      "Additional Contact / Remarks",
    ],
    [
      "Fake Turbines India",
      "Suresh Mock",
      "9845012345",
      "suresh@faketurbines.example",
      "Head of Quality",
    ],
    [
      "Fake Turbines India",
      "Kavita Accounts",
      "9845054321",
      "finance@faketurbines.example",
      "Billing queries",
    ],
    [
      "Precision Gears Ltd",
      "Not found in email",
      "9900112233",
      "procurement@precision.example",
      "PO team",
    ],
    [
      "Peenya Forgings",
      "Manjunath P",
      "Not found in email",
      "not found in email",
      "Site manager",
    ],
  ];

  it("parses rows, groups multiple contacts by company, and treats 'Not found in email' as empty", async () => {
    const buffer = createFakeXlsxBuffer(fakeRows);
    const { groups, totalRows, validRows } = await parseCustomerMaster(buffer);

    expect(totalRows).toBe(4);
    expect(validRows).toBe(4);
    expect(groups).toHaveLength(3);

    // Group 1: Fake Turbines India (2 contacts)
    const turbines = groups.find((g) => g.company === "Fake Turbines India");
    expect(turbines).toBeDefined();
    expect(turbines?.contacts).toHaveLength(2);
    expect(turbines?.contacts[0]).toEqual({
      name: "Suresh Mock",
      mobile: "9845012345",
      email: "suresh@faketurbines.example",
      notes: "Head of Quality",
      receives_invoices: true,
      receives_reports: false,
    });
    expect(turbines?.contacts[1]).toEqual({
      name: "Kavita Accounts",
      mobile: "9845054321",
      email: "finance@faketurbines.example",
      notes: "Billing queries",
      receives_invoices: true,
      receives_reports: false,
    });

    // Group 2: Precision Gears Ltd (Contact Person was 'Not found in email', fallback to Main Contact)
    const gears = groups.find((g) => g.company === "Precision Gears Ltd");
    expect(gears).toBeDefined();
    expect(gears?.contacts).toHaveLength(1);
    expect(gears?.contacts[0].name).toBe("Main Contact");
    expect(gears?.contacts[0].email).toBe("procurement@precision.example");
    expect(gears?.contacts[0].mobile).toBe("9900112233");

    // Group 3: Peenya Forgings (Mobile and email were 'not found in email')
    const forgings = groups.find((g) => g.company === "Peenya Forgings");
    expect(forgings).toBeDefined();
    expect(forgings?.contacts[0].name).toBe("Manjunath P");
    expect(forgings?.contacts[0].email).toBeNull();
    expect(forgings?.contacts[0].mobile).toBeNull();
    expect(forgings?.contacts[0].notes).toBe("Site manager");
  });
});

describe("Customer Master Import – Dry Run & Apply Execution", () => {
  const fakeRows = [
    ["Company", "Contact Person", "Mobile Number", "Email Address", "Additional Contact / Remarks"],
    ["Alpha Forgings", "John Doe", "9876543210", "john@alpha.test", "Primary contact"],
    ["Beta Steels", "Jane Smith", "9876543211", "jane@beta.test", "Accounts"],
  ];

  it("runs in dry-run mode by default without executing database mutations", async () => {
    const buffer = createFakeXlsxBuffer(fakeRows);

    const mockInsert = vi.fn();
    const mockUpdate = vi.fn();

    const mockSupabase = {
      from: (table: string) => {
        if (table === "customers") {
          return {
            select: () => ({
              ilike: (col: string, val: string) => ({
                maybeSingle: async () => {
                  if (val.toLowerCase().includes("alpha")) {
                    return { data: { id: "cust-alpha-123", name: "Alpha Forgings" }, error: null };
                  }
                  return { data: null, error: null };
                },
              }),
            }),
            insert: mockInsert,
          };
        }
        if (table === "customer_contacts") {
          return {
            select: () => ({
              eq: () => async () => ({ data: [], error: null }),
            }),
            insert: mockInsert,
            update: mockUpdate,
          };
        }
        return {};
      },
    } as unknown as Parameters<typeof executeCustomerMasterImport>[0]["supabase"];

    const summary = await executeCustomerMasterImport({
      input: buffer,
      apply: false,
      supabase: mockSupabase,
    });

    expect(summary.dryRun).toBe(true);
    expect(summary.companiesFound).toBe(2);
    expect(summary.customersExisting).toBe(1); // Alpha exists
    expect(summary.customersToCreate).toBe(1); // Beta is new
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();

    const output = formatImportSummary(summary);
    expect(output).toContain("DRY RUN PREVIEW");
    expect(output).toContain("Customers to create:  1");
    expect(output).toContain("Customers existing:   1");
  });

  it("commits mutations when apply = true", async () => {
    const buffer = createFakeXlsxBuffer(fakeRows);

    const mockCustInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: "new-cust-999" }, error: null }),
      }),
    });

    const mockContactInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: "new-contact-888" }, error: null }),
      }),
    });

    const mockSupabase = {
      from: (table: string) => {
        if (table === "customers") {
          return {
            select: () => ({
              ilike: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
            insert: mockCustInsert,
          };
        }
        if (table === "customer_contacts") {
          return {
            select: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
            insert: mockContactInsert,
          };
        }
        return {};
      },
    } as unknown as Parameters<typeof executeCustomerMasterImport>[0]["supabase"];

    const summary = await executeCustomerMasterImport({
      input: buffer,
      apply: true,
      supabase: mockSupabase,
    });

    expect(summary.dryRun).toBe(false);
    expect(summary.customersToCreate).toBe(2);
    expect(mockCustInsert).toHaveBeenCalledTimes(2);
    expect(mockContactInsert).toHaveBeenCalledTimes(2);

    const output = formatImportSummary(summary);
    expect(output).toContain("APPLIED TO DATABASE");
    expect(output).toContain("Import completed successfully.");
  });
});
