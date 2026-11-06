import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import readXlsxFile from "read-excel-file/node";
import type { Database } from "../../lib/db/types";

export interface ParsedContact {
  name: string;
  mobile: string | null;
  email: string | null;
  notes: string | null;
  receives_invoices: boolean;
  receives_reports: boolean;
}

export interface ParsedCompanyGroup {
  company: string;
  contacts: ParsedContact[];
}

export interface ImportSummary {
  dryRun: boolean;
  totalRowsRead: number;
  totalValidRows: number;
  companiesFound: number;
  customersToCreate: number;
  customersExisting: number;
  contactsToCreate: number;
  contactsToUpdate: number;
  companies: Array<{
    name: string;
    status: "new" | "exists";
    id?: string;
    contacts: Array<{
      name: string;
      email: string | null;
      mobile: string | null;
      status: "new" | "update" | "exists";
      id?: string;
    }>;
  }>;
}

/**
 * Cleans cell values from Excel:
 * - Trims whitespace
 * - Treats null, undefined, empty strings, and "Not found in email" (case-insensitive) as null.
 */
export function cleanCell(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).trim();
  if (str.length === 0) {
    return null;
  }

  const lower = str.toLowerCase();
  if (
    lower === "not found in email" ||
    lower.startsWith("not found in email") ||
    lower === "not found" ||
    lower === "none" ||
    lower === "n/a" ||
    lower === "nil" ||
    lower === "-"
  ) {
    return null;
  }

  return str;
}

/**
 * Cleans phone numbers (handles scientific notation or decimal float strings from Excel numeric cells).
 */
export function cleanPhone(value: unknown): string | null {
  const cleaned = cleanCell(value);
  if (!cleaned) return null;
  // If Excel parsed as float (e.g. "9876543210.0"), drop the decimal part
  if (/^\d+\.0+$/.test(cleaned)) {
    return cleaned.split(".")[0];
  }
  return cleaned;
}

/**
 * Cleans and lowercases email address.
 */
export function cleanEmail(value: unknown): string | null {
  const cleaned = cleanCell(value);
  if (!cleaned) return null;
  const email = cleaned.toLowerCase();
  return email.includes("@") ? email : cleaned;
}

interface ColumnIndexes {
  company: number;
  contactPerson: number;
  mobile: number;
  email: number;
  remarks: number;
}

function findHeaderColumns(headerRow: (string | number | boolean | Date | null)[]): ColumnIndexes | null {
  const indexes: Partial<ColumnIndexes> = {};

  headerRow.forEach((cell, idx) => {
    if (!cell) return;
    const str = String(cell).toLowerCase().trim();
    if (str.includes("company") || str.includes("customer")) {
      indexes.company = idx;
    } else if (str.includes("contact person") || (str.includes("contact") && !str.includes("additional"))) {
      indexes.contactPerson = idx;
    } else if (str.includes("mobile") || str.includes("phone")) {
      indexes.mobile = idx;
    } else if (str.includes("email")) {
      indexes.email = idx;
    } else if (str.includes("remarks") || str.includes("additional") || str.includes("notes")) {
      indexes.remarks = idx;
    }
  });

  if (indexes.company === undefined) {
    return null;
  }

  return {
    company: indexes.company,
    contactPerson: indexes.contactPerson ?? -1,
    mobile: indexes.mobile ?? -1,
    email: indexes.email ?? -1,
    remarks: indexes.remarks ?? -1,
  };
}

/**
 * Parses customer master Excel data from a file path or Buffer.
 * Groups multiple rows for the same company into a single company entry with contacts.
 */
export async function parseCustomerMaster(
  input: string | Buffer,
): Promise<{ groups: ParsedCompanyGroup[]; totalRows: number; validRows: number }> {
  const rawResult = await readXlsxFile(input);

  let rawRows: (string | number | boolean | Date | null)[][] = [];
  if (Array.isArray(rawResult)) {
    if (
      rawResult.length > 0 &&
      typeof rawResult[0] === "object" &&
      rawResult[0] !== null &&
      "data" in rawResult[0]
    ) {
      // Returned sheets array: [{ sheet: 'Sheet1', data: [...] }]
      rawRows = (rawResult[0] as { data: (string | number | boolean | Date | null)[][] }).data || [];
    } else {
      // Returned array of rows directly
      rawRows = rawResult as unknown as (string | number | boolean | Date | null)[][];
    }
  }

  if (!rawRows || rawRows.length === 0) {
    return { groups: [], totalRows: 0, validRows: 0 };
  }

  // Look for header row
  let headerIndex = -1;
  let cols: ColumnIndexes | null = null;

  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const candidate = findHeaderColumns(rawRows[i]);
    if (candidate) {
      headerIndex = i;
      cols = candidate;
      break;
    }
  }

  if (!cols || headerIndex === -1) {
    throw new Error(
      "Could not find valid Excel header containing at least 'Company' column.",
    );
  }

  const companyMap = new Map<string, { companyName: string; contacts: ParsedContact[] }>();
  let validRowsCount = 0;

  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const rawCompany = cols.company >= 0 ? cleanCell(row[cols.company]) : null;
    if (!rawCompany) {
      continue; // Skip rows without company name
    }

    validRowsCount++;

    const rawPerson = cols.contactPerson >= 0 ? cleanCell(row[cols.contactPerson]) : null;
    const rawMobile = cols.mobile >= 0 ? cleanPhone(row[cols.mobile]) : null;
    const rawEmail = cols.email >= 0 ? cleanEmail(row[cols.email]) : null;
    const rawRemarks = cols.remarks >= 0 ? cleanCell(row[cols.remarks]) : null;

    const groupKey = rawCompany.toLowerCase();
    if (!companyMap.has(groupKey)) {
      companyMap.set(groupKey, { companyName: rawCompany, contacts: [] });
    }

    const group = companyMap.get(groupKey)!;

    // A contact is added if any contact info is provided
    if (rawPerson || rawMobile || rawEmail || rawRemarks) {
      const contactName = rawPerson || (group.contacts.length === 0 ? "Main Contact" : `Contact ${group.contacts.length + 1}`);

      // Avoid exact duplicate contacts for the same company
      const existingIdx = group.contacts.findIndex(
        (c) =>
          (rawEmail && c.email === rawEmail) ||
          (c.name.toLowerCase() === contactName.toLowerCase() && (c.mobile === rawMobile || !c.mobile)),
      );

      if (existingIdx >= 0) {
        // Merge notes or mobile if missing
        if (!group.contacts[existingIdx].mobile && rawMobile) {
          group.contacts[existingIdx].mobile = rawMobile;
        }
        if (!group.contacts[existingIdx].notes && rawRemarks) {
          group.contacts[existingIdx].notes = rawRemarks;
        }
      } else {
        group.contacts.push({
          name: contactName,
          mobile: rawMobile,
          email: rawEmail,
          notes: rawRemarks,
          receives_invoices: Boolean(rawEmail),
          receives_reports: false,
        });
      }
    }
  }

  const groups: ParsedCompanyGroup[] = Array.from(companyMap.values()).map((g) => ({
    company: g.companyName,
    contacts: g.contacts,
  }));

  return {
    groups,
    totalRows: rawRows.length - (headerIndex + 1),
    validRows: validRowsCount,
  };
}

export interface ExecuteImportOptions {
  input: string | Buffer;
  apply?: boolean;
  supabase?: SupabaseClient<Database>;
}

/**
 * Executes or previews the customer master import.
 */
export async function executeCustomerMasterImport({
  input,
  apply = false,
  supabase,
}: ExecuteImportOptions): Promise<ImportSummary> {
  const { groups, totalRows, validRows } = await parseCustomerMaster(input);

  const client =
    supabase ??
    createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

  const summary: ImportSummary = {
    dryRun: !apply,
    totalRowsRead: totalRows,
    totalValidRows: validRows,
    companiesFound: groups.length,
    customersToCreate: 0,
    customersExisting: 0,
    contactsToCreate: 0,
    contactsToUpdate: 0,
    companies: [],
  };

  for (const group of groups) {
    // 1. Check if customer exists
    const { data: existingCust, error: custErr } = await client
      .from("customers")
      .select("id, name")
      .ilike("name", group.company.trim())
      .maybeSingle();

    if (custErr) {
      throw new Error(`Database error querying customer "${group.company}": ${custErr.message}`);
    }

    let customerId = existingCust?.id;
    const isNewCustomer = !existingCust;

    if (isNewCustomer) {
      summary.customersToCreate++;
    } else {
      summary.customersExisting++;
    }

    if (apply && isNewCustomer) {
      const { data: newCust, error: insertErr } = await client
        .from("customers")
        .insert({ name: group.company.trim() })
        .select("id")
        .single();

      if (insertErr) {
        throw new Error(`Failed to insert customer "${group.company}": ${insertErr.message}`);
      }
      customerId = newCust.id;
    }

    const companyReport: ImportSummary["companies"][number] = {
      name: group.company,
      status: isNewCustomer ? "new" : "exists",
      id: customerId,
      contacts: [],
    };

    // 2. Process contacts for this company
    let existingContacts: Array<{ id: string; name: string; email: string | null; mobile: string | null }> = [];
    if (customerId) {
      const { data: contactsData, error: contactsErr } = await client
        .from("customer_contacts")
        .select("id, name, email, mobile")
        .eq("customer_id", customerId);

      if (contactsErr) {
        throw new Error(`Failed to query contacts for customer "${group.company}": ${contactsErr.message}`);
      }
      existingContacts = contactsData ?? [];
    }

    for (const c of group.contacts) {
      const existingMatch = existingContacts.find(
        (ec) =>
          (c.email && ec.email && ec.email.toLowerCase() === c.email.toLowerCase()) ||
          ec.name.toLowerCase() === c.name.toLowerCase(),
      );

      if (!existingMatch) {
        summary.contactsToCreate++;
        companyReport.contacts.push({
          name: c.name,
          email: c.email,
          mobile: c.mobile,
          status: "new",
        });

        if (apply && customerId) {
          const { data: insertedContact, error: insertContactErr } = await client
            .from("customer_contacts")
            .insert({
              customer_id: customerId,
              name: c.name,
              mobile: c.mobile,
              email: c.email,
              notes: c.notes,
              receives_invoices: c.receives_invoices,
              receives_reports: c.receives_reports,
            })
            .select("id")
            .single();

          if (insertContactErr) {
            throw new Error(`Failed to insert contact "${c.name}" for "${group.company}": ${insertContactErr.message}`);
          }
          companyReport.contacts[companyReport.contacts.length - 1].id = insertedContact.id;
        }
      } else {
        const needsUpdate =
          (!existingMatch.mobile && c.mobile) ||
          (c.notes && c.notes.length > 0);

        if (needsUpdate) {
          summary.contactsToUpdate++;
          companyReport.contacts.push({
            name: c.name,
            email: c.email,
            mobile: c.mobile,
            status: "update",
            id: existingMatch.id,
          });

          if (apply) {
            const { error: updateErr } = await client
              .from("customer_contacts")
              .update({
                mobile: c.mobile ?? existingMatch.mobile,
                ...(c.notes ? { notes: c.notes } : {}),
              })
              .eq("id", existingMatch.id);

            if (updateErr) {
              throw new Error(`Failed to update contact "${c.name}": ${updateErr.message}`);
            }
          }
        } else {
          companyReport.contacts.push({
            name: c.name,
            email: c.email,
            mobile: c.mobile,
            status: "exists",
            id: existingMatch.id,
          });
        }
      }
    }

    summary.companies.push(companyReport);
  }

  return summary;
}

/**
 * Formats the summary into a readable CLI report.
 */
export function formatImportSummary(summary: ImportSummary): string {
  const lines: string[] = [];
  lines.push(`=======================================================`);
  lines.push(`  Customer Master Import ${summary.dryRun ? "[DRY RUN PREVIEW]" : "[APPLIED TO DATABASE]"}`);
  lines.push(`=======================================================`);
  lines.push(`Total rows in file:     ${summary.totalRowsRead}`);
  lines.push(`Valid company rows:     ${summary.totalValidRows}`);
  lines.push(`Distinct companies:     ${summary.companiesFound}`);
  lines.push(``);
  lines.push(`Actions:`);
  lines.push(`  Customers to create:  ${summary.customersToCreate}`);
  lines.push(`  Customers existing:   ${summary.customersExisting}`);
  lines.push(`  Contacts to create:   ${summary.contactsToCreate}`);
  lines.push(`  Contacts to update:   ${summary.contactsToUpdate}`);
  lines.push(`-------------------------------------------------------`);

  for (const c of summary.companies) {
    const custTag = c.status === "new" ? "[NEW CUSTOMER]" : `[EXISTS ${c.id ?? ""}]`;
    lines.push(`• ${c.name} ${custTag} (${c.contacts.length} contacts)`);
    for (const ct of c.contacts) {
      const contactTag = ct.status === "new" ? "[NEW]" : ct.status === "update" ? "[UPDATE]" : "[UNCHANGED]";
      lines.push(`    - ${ct.name} | ${ct.email || "No email"} | ${ct.mobile || "No phone"} ${contactTag}`);
    }
  }

  lines.push(`-------------------------------------------------------`);
  if (summary.dryRun) {
    lines.push(`ℹ This was a dry run. No changes were committed to the database.`);
    lines.push(`  To execute the import, run with: --apply`);
  } else {
    lines.push(`✔ Import completed successfully.`);
  }

  return lines.join("\n");
}

// CLI entry point
if (typeof process !== "undefined" && process.argv && process.argv[1]?.includes("customer-master")) {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.log("Usage: npx tsx scripts/import/customer-master.ts <file.xlsx> [--apply]");
    console.log("Default mode is --dry-run.");
    process.exit(0);
  }

  executeCustomerMasterImport({ input: filePath, apply: isApply })
    .then((summary) => {
      console.log(formatImportSummary(summary));
    })
    .catch((err) => {
      console.error("Error during customer master import:", err);
      process.exit(1);
    });
}
