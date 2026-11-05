# Handoff – switching agents, accounts or people without losing context

Coding agents do not remember past chats. This project's memory is the files in this repo:
`AGENTS.md` (rules), `docs/PROJECT_BRIEF.md` (business context), `docs/WORK_PLAN.md` (who does what),
`docs/PROGRESS.md` (where things stand), `docs/DECISIONS.md` (why things are the way they are), and this file (where each unfinished task stopped).
If it is not written here, the next agent will not know it.

## Session-start prompt (paste into Codex or Claude at the start of every session)

```
You are working on the BITA Business Management System repository.
Before doing anything else:
1. Read AGENTS.md and follow it.
2. Read docs/PROGRESS.md (status board and last three log entries).
3. Read the latest entry for my area in docs/HANDOFF.md, if any.
4. Read my section of docs/WORK_PLAN.md and skim docs/DECISIONS.md.
5. Read docs/PROJECT_BRIEF.md for any business rule you need.

I am <NAME>. My task today is: <TeamSync task title and one line of detail>.
Tell me in 3 lines what you understand the task to be, which files you will touch,
and anything that looks unclear or outside my area. Do not write code until I confirm.
```

## Kick-off prompts (paste once, in your first session on the revised plan of 5 Nov)

Each prompt is complete on its own. After the first session, use the session-start prompt above.

### Pavana – first session

```
You are working on the BITA Business Management System repository with me, Pavana.
Before doing anything else, read AGENTS.md, docs/PROJECT_BRIEF.md (especially section 3, BITA's requirements
R1–R41 and X1–X4), docs/WORK_PLAN.md, docs/DECISIONS.md, docs/PROGRESS.md and the migration in
supabase/migrations/. Follow AGENTS.md exactly.

My area (I may only create or edit files here):
  app/(office)/ except app/(office)/registers/ · app/(field)/ · app/(reports)/ · templates/reports/ · lib/reports/ · components/
Never edit: supabase/, lib/supabase/, lib/db/, lib/field/, package.json, config files, AGENTS.md, or anyone else's folder.
If I need a column, a table, a package or a change in someone else's file, write it under Requests in docs/PROGRESS.md
and tell me; do not work around it.

My tasks, in this order (TeamSync 19, 20, 21, 22, 52):
1. Branch feature/pavana-customers: office layout and menu (app/(office)/layout.tsx), customer list,
   customer page with contacts (customers, customer_contacts). Fields: name, code, GSTIN, billing address,
   proforma yes/no, payment terms, mailbox, contacts with "receives reports" / "receives invoices".
2. Branch feature/pavana-enquiries: enquiry list and manual entry for phone and WhatsApp (enquiries table).
   Link an enquiry to an existing customer (R4).
3. Branch feature/pavana-quotations: quotation with items (quotations, quotation_items), PDF on BITA letterhead in
   the style of BITA's WEG quotation sample (R8), search past items and rates (R9), approval by management only (R10).
   No expiry date (R11). Default terms: payment within 30 days from invoice date; GST at 18% as applicable (R12).
4. Branch feature/pavana-jobs: job page that shows everything for one Job ID (R18), PO number and file (R14),
   assignment of a technician and equipment (assignments, assignment_equipment) showing the technician's
   qualification for the method and an "expired" warning (qualification_status view, R20).
5. Branch feature/pavana-field-form: technician phone form at app/(field)/, opened from a WhatsApp link, no login (R21).
   Readings per method from BITA Table 4.4, photos and drawings. Put the list of fields per method and which are
   mandatory in lib/reports/fields.ts; missing mandatory readings are listed in inspections.missing_fields (X2).
   Naveen provides lib/field/ (token check and save); until it lands, use a mock with the same function names.
6. Branch feature/pavana-reports: UT, MT and DPT report layouts that reproduce BITA's formats exactly (R22, R23),
   one report number per report as BITA numbers them (R16), review and approval by a reviewer only (R26),
   signatures and seal added only after approval (R27), PDF, send to the customer's report contacts,
   and a correction history view from audit_log (R28, X3).

Rules that matter most for me:
- Phone width 375 px first; every screen must work on a phone.
- Use the Supabase client from lib/supabase/ and table types from lib/db/. Row Level Security enforces roles;
  never bypass it and never use the service role key in my code.
- Test data only. BITA's real sample reports are shared with me outside the repo; never copy them into it.
- Do not calculate GST or any money in our code (Zoho Books does it).
- Small pull requests, at least one a day; rebase on origin/main every morning.

Now: tell me in 3 lines what you understand task 1 to be and which files you will create.
Do not write code until I confirm.
```

### Krishna – first session

```
You are working on the BITA Business Management System repository with me, Krishna (intern).
Before doing anything else, read AGENTS.md, docs/PROJECT_BRIEF.md (especially section 3, BITA's requirements
R1–R41 and X1–X4), docs/WORK_PLAN.md, docs/DECISIONS.md, docs/PROGRESS.md and the migration in
supabase/migrations/. Follow AGENTS.md exactly. Explain things to me in simple words as we go; I am learning.

My area (I may only create or edit files here):
  scripts/seed/ · scripts/import/ · tests/ · app/(office)/registers/ · docs/GLOSSARY.md · docs/CLIENT_INPUTS.md · docs/guide/
Never edit: supabase/, lib/, components/, app/ outside app/(office)/registers/, package.json, config files,
AGENTS.md, or anyone else's folder. If I need something there, write it under Requests in docs/PROGRESS.md
and tell me; do not work around it.

My tasks, in this order (TeamSync 23, 24, 25, 51, 26, 27, 28):
1. Branch feature/krishna-test-data:
   a. docs/GLOSSARY.md: BITA's terms in plain words (UT, MT/MPT, DPT, RT, VT, RLA, SCR = short circuit ring,
      BFL shaft, WI, ERS, couplant, probe, sensitivity, dwell time, proforma, PO, Job ID, report number, and others
      you find in docs/PROJECT_BRIEF.md and the migration).
   b. scripts/seed/seed.sql: FAKE test data in the exact shape of the database tables: 9 customers (one marked as
      using a proforma), 2-4 contacts each, 4 people (2 management + reviewer with login placeholders, 2 technicians
      without login), qualifications with one expired certificate, 4 UT flaw detectors and 2 MPI yokes (one
      calibration overdue), 20 enquiries (email, phone, WhatsApp), a few quotations with items, 10 jobs in different
      statuses with inspections and reports. All names, numbers, emails and GSTINs must be invented
      (GSTIN must match ^[0-9]{2}[A-Z0-9]{13}$). Never use any real BITA customer, person or number.
   c. docs/CLIENT_INPUTS.md: replace the list with the 30 items Naveen asked BITA for on 5 Nov
      (Naveen gives me the list), with columns: item, status (asked / received / not applicable), date, notes.
2. Branch feature/krishna-registers: screens in app/(office)/registers/ for the qualification register
   (person, method, level, scheme, certificate number, issued, valid until, certificate copy, expired flag;
   R19, R20) and the equipment register (kind, make, model, serial number, calibrated on, due, certificate copy;
   R29–R31). Use shared components from components/ (ask Pavana for any new one) and table types from lib/db/.
3. scripts/import/: a script that reads a customer master Excel file with the columns
   Company | Contact Person | Mobile Number | Email Address | Additional Contact / Remarks
   and loads customers and contacts. Test it only with a fake Excel file I make. The real file is run by Naveen.
4. tests/: smoke tests for customers, enquiries, quotations and registers, and daily testing of whatever was merged.
5. docs/guide/: a user guide for the two office users, and a one-page WhatsApp guide for technicians.

Rules that matter most for me:
- Test data only. Never put any real BITA data in the repo, in tests, in screenshots or in prompts.
- Every screen must work at phone width (375 px).
- Small pull requests, at least one a day; rebase on origin/main every morning.

Now: tell me in 3 lines what you understand task 1 to be and which files you will create.
Do not write code until I confirm.
```

### Naveen – first session (Codex or Claude)

```
You are working on the BITA Business Management System repository with me, Naveen (lead).
Read AGENTS.md, docs/PROJECT_BRIEF.md, docs/WORK_PLAN.md, docs/DECISIONS.md, docs/PROGRESS.md, the latest
"Naveen" entry below in docs/HANDOFF.md and supabase/migrations/. Follow AGENTS.md exactly.
My area is every path marked Naveen in the AGENTS.md ownership table. Pavana and Krishna work in parallel in
their own folders; never edit their files.
Today, in order: generate lib/db/types.ts from the dev database; login page in app/(auth)/; storage buckets
migration; lib/field/ (verify a per-job phone-link token by its hash, save an inspection as the technician with
app.actor_person_id set). Then email intake for both mailboxes.
Tell me in 3 lines what you will do first and which files you will touch. Do not write code until I confirm.
```

## Session-end prompt (paste before you stop, switch agent, or run out of credits)

```
We are ending this session. Do these now:
1. Add a log entry at the top of the Log in docs/PROGRESS.md using its template.
2. Update my row on the status board in docs/PROGRESS.md.
3. If the task is not finished, add a handoff entry at the top of "Handoff entries" in docs/HANDOFF.md
   using its template: exact stopping point, next step, files touched, commands to run, known problems.
4. Add any new decision to docs/DECISIONS.md and any question for BITA to Open questions.
5. Show me the git diff summary and a suggested commit message.
```

## Handoff entry template

```
### YYYY-MM-DD HH:MM – <Name> – <area> – from <agent> to <next agent or person>
Branch: feature/<name>-<topic>   (pushed: yes / no)
Task: <TeamSync task title>
Stopped at: <exactly what works and what does not yet>
Next step: <the very next thing to do>
Files touched: <list>
How to run / test: <commands, test user, page to open>
Known problems: <bugs, failing tests, TODOs>
Decisions made in this session: <or "none">
```

## Handoff entries (newest first)

### 2026-11-05 – Naveen – repo, schema, roles – from Claude Code to Naveen's next session
Branch: feature/naveen-setup   (pushed: no)
Task: BITA: Set up repository, database and team access
Stopped at: app skeleton, Supabase client helpers, session middleware and the first migration are done and tested
  (11 database tests in supabase/tests/ pass with `npm test`; lint, type check and build pass). There is no Supabase
  project yet, so nothing is applied to a real database. There are no storage buckets, no login page and no lib/db/types.ts yet.
Next step: push the branch and merge the PR; create the dev Supabase project; apply the migration; send
  `.env.local` privately to Pavana and Krishna; generate lib/db/types.ts; ask QuantumWeaveDev26 to invite Pavana and Krishna.
Files touched: app/, lib/supabase/, middleware.ts, supabase/, package.json, .gitignore, .env.example, AGENTS.md, docs/
How to run / test: `npm install`, `npm test`, `npm run dev`
Known problems: `npm audit` reports PostCSS inside Next 15 (build time only, our own CSS); fixed only by Next 16.
Decisions made in this session: D-008 to D-012 in docs/DECISIONS.md.
