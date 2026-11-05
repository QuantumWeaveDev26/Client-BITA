# Project brief – BITA Business Management System

The single source of business context for this project. If something here is wrong or out of date, fix it in the same pull request and note it in `docs/DECISIONS.md`.

## 1. The client

**BITA – Bangalore Inspection & Testing Agency**, Vidyaranyapura, Bangalore. MSME, running since 1987.
Founder and Managing Director: **S. Radhakrishnan** (ASNT Level II in UT, RT, MPT, DPT, VT; Competent Person for lifting machines, tackles and pressure vessels).

**What they do**

- **NDT (non-destructive testing):** Ultrasonic Testing (UT), Magnetic Particle Testing (MPT), Dye Penetrant Testing (DPT), Radiography (RT, through their associate Madras Radiography Engineers). Finds cracks and defects in welds, castings, forgings and plates without damaging them.
- **Inspection, testing and certification** of cranes, lifting tackle, pressure vessels and dangerous machines under the Factories Act.
- **Residual Life Assessment (RLA)** of boilers, turbines, penstocks, digesters and generator shafts at power and process plants.
- **In-situ metallography, hardness measurement, thickness gauging, general inspection** (gearboxes, motors, pumps, structures).

Work is done mostly **on the customer's site** with portable equipment. **What customers pay for is the signed report or certificate.**

**Customers** are businesses: L&T, KEC, HAL, GTRE, BEML, BMRCL, ThyssenKrupp, WEG, TD Power, Voith Hydro, TRF (Tata Steel), NTPC plants (via CPRI), Grasim, West Coast Paper Mills, ISRO/ITER/BARC/NPCIL suppliers and others. Most work is repeat business, ordered by purchase order (PO).

**The problem:** enquiries, quotes, scheduling, field data, reports, invoicing and payment follow-up are handled by hand, and coordination depends on individual people. BITA wants standard processes and one connected record per job.

## 2. The workflow we automate

Customer Enquiry → Customer Registration → Job Identification → PO / Quotation → Job Creation → Technician Allocation → Inspection → Field Data Submission → Report Generation → Technical Approval → Report Submission → Proforma Invoice → Zoho Books → GST Invoice → Payment Collection → Job Closure.

## 3. What the system does, area by area

| # | Area | What it does |
| --- | --- | --- |
| 1 | Customer enquiry | Email enquiries captured automatically from BITA's inbox; phone and WhatsApp enquiries logged by office staff; AI extracts customer, item and test type; existing customer matched by GSTIN, email or phone, new customer gets a profile |
| 2 | Job identification and commercial approval | New or recurring job; PO required for every new job; recurring jobs reuse past terms and rates; management decides whether a fresh quotation is needed; quotation PDF in BITA's format, sent for approval |
| 3 | Job creation and scheduling | Unique Job ID; customer, PO, quotation and scope linked; site, date, equipment and test requirements; technician allocation with clash warning |
| 4 | Inspection | Technician phone form: readings, observations, photos; submitted to office |
| 5 | Reports | Report drafted from field data into BITA's template for that test type; technical review and approval; final PDF with logo and signature; emailed to customer; stored against the Job ID |
| 6 | Proforma and billing | Proforma from agreed terms and actual work; converted to GST tax invoice in Zoho Books; invoice details recorded on the job |
| 7 | Zoho Books | Customers, proformas, invoices, payments and balances synced (see section 6) |
| 8 | Payments | Outstanding tracked per invoice; reminders on BITA's schedule; payment status from Zoho; job closes when report is sent and invoice is paid |
| 9 | Dashboard | Customers, enquiries, pending quotes and POs, active and completed jobs, technician schedules, reports, invoices, outstanding payments, revenue, summaries |

**BITA's requirements document (5 Nov 2026) replaces the table above where they differ.** It lists R1–R41 and X1–X4, and all of them are in scope (D-008). The main differences:

- Enquiries arrive in two Gmail mailboxes, one for TDPS and one for all other customers, plus a dedicated WhatsApp Business number captured automatically (R2, R3).
- There is no standard rate list: management types prices on each quotation, and past quotations must be searchable (R9). Quotations have no expiry (R11). No PO is needed before work starts (R14).
- One job can have several reports, and each keeps BITA's existing report number (R16).
- Technicians have **no logins**. They work over WhatsApp: daily assignments, acknowledgements, delays, leave, equipment and site issues, photos, and readings through a per-job phone link (R21, X1).
- There is a qualification register with an expiry flag when assigning (R19, R20), and an equipment register covering 4 UT flaw detectors and 2 MPI yokes (R29–R31).
- Mandatory readings are checked on submission, and a report can't be prepared until they're complete (X2). Every correction keeps the old value, the new value, who and when, and management is told (R28, X3).
- Signatures and seal go on a report only after approval (R27).
- The proforma step is for TDPS only, set customer by customer (R33, R34).
- Reminders go out 2 days before the due date, on the due date, then daily from the 5th day after it (R35). They're sent from the mailbox for that customer (R36), and management can pause them (R37).
- The dashboard shows 3 numbers: active jobs, pending reports, outstanding payments (R39).
- Financial reports are read from Zoho Books (X4).

**Follows after delivery:** offline mode for the field form, trend analytics.

## 4. Data model (first version; Naveen owns the schema)

The live schema is `supabase/migrations/`. It supersedes the table below where they differ (e.g. `people` + `qualifications` replace `technicians`; `assignments` replace `schedules`; `audit_log` holds every correction).

| Table | Key fields | Links to |
| --- | --- | --- |
| customers | name, gstin, contacts, billing address, zoho_contact_id | enquiries, jobs |
| enquiries | source (email/phone/whatsapp), raw text, extracted fields, status | customers, jobs |
| quotations | items, rates, GST %, validity, approval status, pdf | jobs |
| purchase_orders | po number, date, value, file | jobs |
| jobs | job_id, type (new/recurring), scope, test methods, site, status | customers, purchase_orders, quotations |
| technicians | name, NDT methods and levels, phone, user id | schedules |
| schedules | job, technician, date, equipment | jobs, technicians |
| inspections | readings (JSON per test type), observations, photos, submitted_at | jobs |
| reports | template, draft, reviewer, approved_at, pdf, sent_at | jobs |
| invoices (mirror of Zoho) | zoho_invoice_id, number, date, taxable value, GST, status, balance | jobs |

**Job status lifecycle:** `enquiry_received` → `awaiting_approval` → `scheduled` → `inspection_done` → `report_in_review` → `report_sent` → `invoiced` → `closed`.

## 5. Users and roles

| Role | Can do |
| --- | --- |
| management | Everything, including dashboard, quotation approval, fresh-quote decision |
| office | Enquiries, customers, quotations, POs, jobs, scheduling, billing |
| reviewer | Review, approve or return reports |
| technician | No login (R21). Works over WhatsApp and a per-job phone link; the server writes their data |

Users at delivery: two people, both with management and reviewer rights (R40). The office role stays available but nobody holds it yet.

## 6. Zoho Books rules

Zoho Books is the **single source of truth** for accounting. We never calculate GST or keep a ledger.

| Event in our system | Action in Zoho Books | What we store back |
| --- | --- | --- |
| New customer | Create contact | zoho_contact_id |
| Job ready to bill | Create estimate (used as proforma) | proforma number, PDF |
| Proforma accepted | Convert to GST tax invoice | invoice number, date, taxable value, GST amount |
| Payment recorded in Zoho | Nothing (accountant records it) | payment status, balance (synced hourly) |

Configured inside Zoho by BITA's accountant, not built by us: GST rates, HSN/SAC codes, GSTR-1/3B, e-invoicing, e-way bills, expenses, Profit & Loss, Balance Sheet.
Every Zoho call carries the Job ID as reference. Never create an invoice for a job that already has a `zoho_invoice_id`.

## 7. Inputs requested from BITA

Sent to BITA on 2 Nov as the "Information and Documents Required" PDF. Priority items due Tue 3 Nov, the rest Wed 4 Nov. Tracked item by item in `docs/CLIENT_INPUTS.md`.

## 8. Internal timeline

Build Tue 3 Nov to Mon 9 Nov (Mon to Fri). Internal target: **ready for delivery on Tue 10 Nov.** Client-facing dates are handled by Naveen only. Day-by-day plan per person: `docs/WORK_PLAN.md`.

## 9. Key documents

- Client roadmap deck (client-facing): BITA Business Management System – Project Roadmap
- Internal roadmap (architecture, Zoho design): team only
- BITA's original requirements and company profile: shared folder (link in TeamSync project)
- Task tracking: TeamSync project "BITA – Business Management System"
