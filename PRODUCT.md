# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Management (2 people): Anand Teertha and S. Radhakrishnan** of Bangalore Inspection & Testing Agency (BITA), a small founder-run NDT and inspection firm in Bengaluru, running since 1987. Both are also the technical reviewers; S. Radhakrishnan is the default report signatory. They use the system **equally on the office desktop and on a phone between site visits**, and want **everything controllable from the dashboard**: approve reports, chase payments, assign jobs, answer enquiries.
- **Technicians** (R. Raghavendra Rao, V. Shiva Kumar and others) log into the same web app (D-015). On a phone, on customer sites, they see only their own assigned jobs and enter readings, photos and site issues.
- No customer-facing users: BITA's customers get reports and invoices by email, never a login.

## Product Purpose

One connected record per job, from customer enquiry to payment: enquiry, quotation, PO, job and Job ID, technician assignment, field data, inspection report with technical approval, proforma and GST invoice in Zoho Books, payment follow-up, and job closure. It replaces notebooks, Word files and memory, so the firm runs on standard steps instead of on individual people. Success: management can see and act on every open item each day without asking anyone.

## Positioning

Built around how an NDT inspection firm actually works. The product customers pay for is the **signed inspection report or certificate**, so report review and approval sit at the centre. BITA's own report formats (UT, MT, DPT), report numbers and quotation letterhead are reproduced exactly. Zoho Books stays the accounting system.

## Operating Context

- Work happens mostly on customers' sites (power plants, motor and gear makers, paper mills) with portable ultrasonic flaw detectors and MPI yokes.
- About 9 business customers, mostly repeat work. One customer (TDPS) gets a proforma first; the others are invoiced directly. Payment terms are typically 30 days.
- Two Gmail mailboxes bring in enquiries (one for TDPS, one for the rest); phone and WhatsApp enquiries too.
- Reminders run on BITA's schedule: 2 days before the due date, on the due date, and daily from the 5th day overdue.
- Daily numbers management wants (R39): **active jobs, pending inspection reports, outstanding payments with amount**.

## Capabilities and Constraints

- Next.js web app with Supabase (Postgres, Row Level Security, Storage). Roles are management, office, reviewer and technician, enforced in the database.
- **Zoho Books is the source of truth for money.** The app shows invoice numbers, amounts, balances and status mirrored from Zoho, and never calculates GST.
- No report leaves without a technical reviewer's approval; signatures and the seal are applied only after approval.
- Corrections keep the original and corrected values, with who and when.
- Terminology: Job ID `BITA/26-27/0001` (format pending BITA's confirmation); BITA report numbers such as `010/TDPS/1225`; test methods UT, MPT, DPT, RT, VT, hardness, metallography, RLA, certification.
- Open: Zoho Books access (BITA's migration isn't finished), mailbox access, hosting choice.

## Brand Commitments

- Name: **Bangalore Inspection & Testing Agency (BITA)**. The logo, company seal and signatures exist; they're used on reports and are real client files, kept outside the repo.
- Voice: plain, factual business English. Indian number format (₹1,23,456) and IST dates.
- The app must never show how it was built (no tooling or AI names) to BITA.

## Evidence on Hand

- BITA's requirements document (R1–R41, X1–X4), sample UT/MT/DPT reports and blank formats, a WEG quotation sample, technician certificates and calibration certificates, all supplied by BITA and kept outside the repo.
- In development: fake test data only. **No real customer data, testimonials or figures may appear in the app's code, screenshots or demos.**

## Product Principles

1. **Every open item is one tap from the dashboard.** If management has to ask someone where a job stands, the product failed.
2. **The report is the product.** Review, approval and signing get the clearest path.
3. **Money comes from Zoho.** Show it faithfully; never compute or contradict it.
4. **Works on site.** Every screen is usable on a phone in bad light with one hand.
5. **Nothing is lost.** Every change is recorded, with who and when.

## Accessibility & Inclusion

English is fine for all users. Phone and desktop are equally important. Field use means outdoor light, so strong contrast is needed.
