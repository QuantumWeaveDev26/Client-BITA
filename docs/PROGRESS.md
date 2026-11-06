# Progress – where the project stands

Everyone reads the status board and the last three log entries at the start of every session.
Everyone adds a log entry at the end of every session (newest at the top of the log).

## Status board

| Area | Owner | Status | Branch / PR | Notes |
| --- | --- | --- | --- | --- |
| Repo, schema, roles, security | Naveen | In review | feature/naveen-setup | App skeleton + first schema with RLS and correction log; Supabase project not created yet |
| Email intake + AI extraction | Naveen | Not started | | |
| Customer and enquiry screens | Naveen | In review | feature/naveen-login-customers-enquiries | Login, customers with contacts, enquiries with customer link |
| Jobs, quotations, POs, scheduling | Naveen | Not started | | |
| Technician field form | Naveen | Not started | | |
| Report templates + approval + PDF | Naveen | In progress | feature/naveen-report-templates | T8a typed fields and mandatory-reading validation ready; paper templates and staff preview in progress |
| AI report drafting | Naveen | Not started | | |
| Zoho Books integration | Naveen | Not started | | Needs Zoho admin access |
| Payments, reminders, job closure | Naveen | Not started | | |
| Dashboard | Naveen | Not started | | |
| WhatsApp intake + technician messages (R3, X1) | Naveen | Not started | | Needs BITA's WhatsApp Business number |
| Financial reports from Zoho (X4) | Naveen | Not started | | Needs Zoho access |
| Submission checks + correction history view (X2, X3) | Naveen | Not started | | Database side done in setup PR |
| Qualification + equipment registers (R19–R20, R29–R31) | Naveen | Not started | | |
| Glossary | Krishna | Not started | | |
| Test data | Krishna | Not started | | |
| Client inputs tracker | Krishna | Not started | | See `docs/CLIENT_INPUTS.md` |
| Excel import | Naveen | Not started | | Needs BITA lists |
| Smoke tests | Naveen | Not started | | |
| User guide | Krishna | Not started | | |

Status values: Not started · In progress · In review · Done · Blocked

## Bugs (Krishna adds after each evening's testing; Naveen fixes)

| Date | Page | Steps to repeat | What happened | What should happen | Status |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Requests (someone needs something from another area)

| Date | From | To | Request | Status |
| --- | --- | --- | --- | --- |
| | | | | |

## Open questions (for BITA, asked only by Naveen)

| Date | Asked by | Question | Answer |
| --- | --- | --- | --- |
| 2026-11-05 | Naveen | One email to BITA with 30 items: mailbox and Zoho access, WhatsApp number, separate user emails, technician mobiles, customer billing addresses and codes, report and quotation number rules, Job ID format, other report types, field datasheets, MPI yokes, past jobs and quotations, hosting account, test job and training date | Due Sat 7 Nov |

## Blockers

| Date | Who | Blocked on | Since |
| --- | --- | --- | --- |
| 2026-11-05 | Naveen | Mailbox access (email intake), Zoho Books access (BITA's migration not finished), WhatsApp Business number (R3, X1) | 2026-11-05 |

## Log

### Template (copy this for each entry)

```
### YYYY-MM-DD HH:MM – <Name> – <agent used: Codex / Claude Code / Claude>
Task: <TeamSync task title>
Done: <what was finished, in plain words>
Files changed: <main files or folders>
Next: <the next concrete step>
Blockers / questions: <or "none">
```

### 2026-11-06 11:48 – Naveen – Codex
Task: T8a report field definitions and paper layouts
Done: Added typed UT/MPT/DPT readings, MT alias, shared fields and repeated technician/item groups. missingFields returns stable scalar/dotted paths for inspections.missing_fields and validates every row. Eleven field tests pass. Orion approved the contract; pushing it early for T7.
Files changed: lib/reports/fields.ts, lib/reports/fields.test.ts, docs/PROGRESS.md, docs/HANDOFF.md
Next: Finish source-format paper templates, approval-gated signature slots, staff-only fake-data preview and A4 print checks.
Blockers / questions: none for the field contract.

### 2026-11-05 18:30 – Naveen – Claude Code
Task: BITA: Customer and enquiry screens
Done: Storage buckets (documents, branding, reports; staff only, signatures by management only), applied to bita-dev. Login page, office layout with menu, customers (list with search, new, edit, contacts with "receives reports/invoices"), enquiries (list with filters, manual entry for phone/WhatsApp/email, link to customer with automatic suggestion by sender email or mobile, status). 13 database tests pass; lint, type check and build pass; login page checked at 375 px.
Files changed: supabase/migrations/20261106000000_storage.sql, app/(auth)/, app/(office)/, components/ui.tsx, lib/auth.ts, lib/forms.ts
Next: quotations (letterhead PDF, past rates, approval), jobs and PO.
Blockers / questions: logged-in screens not yet clicked through; needs the first login user in bita-dev.

### 2026-11-05 17:00 – Naveen – Claude Code
Task: BITA: Set up repository, database and team access
Done: Dev Supabase project `bita-dev` created; both migrations applied; security advisor clean (one info note: job_counters has no policies, on purpose). `lib/db/types.ts` generated and the Supabase clients are typed. `.env.local` ready to share privately.
Files changed: supabase/migrations/20261105010000_private_helpers.sql, lib/db/types.ts, lib/supabase/, supabase/tests/, docs/
Next: storage buckets, login page, `lib/field/`; load Krishna's test data when it lands.
Blockers / questions: none new.

### 2026-11-05 – Naveen – Claude Code
Task: BITA: Set up repository, database and team access
Done: BITA's requirements (R1–R41, X1–X4) and files received; full scope agreed (D-008). Next.js app skeleton, Supabase client helpers, first database schema with roles, Row Level Security, Job ID numbering, report approval and readings checks, one-GST-invoice-per-job rule and correction log. 11 database tests pass (npm test). `.gitignore` keeps client files out of git.
Files changed: app/, lib/supabase/, middleware.ts, supabase/, package.json, .gitignore, .env.example, docs/
Next: create the Supabase project and apply the migration; storage buckets; login page; give Pavana and Krishna repo access.
Blockers / questions: mailbox, Zoho and WhatsApp access from BITA (asked 5 Nov, due 7 Nov).

### 2026-11-02 – Naveen – Claude
Task: Project kick-off
Done: Reviewed BITA's requirements and company profile; client roadmap deck and "Information and Documents Required" PDF prepared and sent to BITA; TeamSync project created with tasks for Naveen, Pavana and Krishna; team pack written (AGENTS.md, CLAUDE.md, docs/).
Files changed: AGENTS.md, CLAUDE.md, docs/
Next: Tue 3 Nov – repo setup, schema, access for team; team starts on their Day 1 tasks.
Blockers / questions: Waiting for BITA's priority inputs (due Tue 3 Nov).
