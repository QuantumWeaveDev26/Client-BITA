# AGENTS.md – BITA Business Management System

Instructions for every coding agent (Codex, Claude Code, Claude) and every person working in this repository.
**Read this file at the start of every session.** `CLAUDE.md` points here, so Claude and Codex follow the same rules.

## The project in one paragraph

We are building a business management system for **BITA (Bangalore Inspection & Testing Agency)**, an NDT and inspection company running since 1987.
It connects their whole workflow under one Job ID: customer enquiry → PO or quotation → job and scheduling → technician field data →
report and technical approval → proforma and GST invoice in **Zoho Books** → payment follow-up → job closure, plus a management dashboard.
Full context: `docs/PROJECT_BRIEF.md`.

## Start of every session (do these in order)

1. `git checkout main && git pull`, then switch to (or create) your branch.
2. Read `docs/PROGRESS.md`: the status board and the last three log entries.
3. Read the latest entry for your area in `docs/HANDOFF.md`, if there is one.
4. Read your section of `docs/WORK_PLAN.md` and skim `docs/DECISIONS.md`.
5. Read `docs/PROJECT_BRIEF.md` whenever you need business rules, the data model or Zoho rules.
6. Say back to the human, in two or three lines, what you understand the task to be before writing code.

## End of every session (mandatory, even if the task is unfinished)

1. Add an entry at the top of the log in `docs/PROGRESS.md` (template is in that file).
2. Update your row on the status board in `docs/PROGRESS.md`.
3. If the task is not finished, write a handoff entry in `docs/HANDOFF.md`, so any other agent or person can continue.
4. Commit the docs together with the code.

The human also posts a short check-in on the TeamSync project "BITA – Business Management System".

## Stack

| Layer | Technology |
| --- | --- |
| Web app | Next.js (App Router, TypeScript) |
| Database, logins, files | Supabase (Postgres, Auth, Storage, Row Level Security) |
| Automations | n8n (email intake, Zoho sync, reminders, outgoing email); workflow exports kept in `n8n/` |
| AI | Claude API (reading enquiries, drafting report text) |
| Accounting | Zoho Books API (India) |
| Hosting | Decided by Naveen at setup (Vercel or Hostinger) |

UI library, test runner and folder details are recorded in `docs/DECISIONS.md` (D-010): Next.js 15, Tailwind CSS, Vitest.

## Who owns which folder

**Each file has exactly one owner. Only the owner (and their coding agent) edits it.** This is how three people work at the same time without overwriting each other.
If you need something in another area, write a request in `docs/PROGRESS.md` under **Requests** and tell the owner. Do not "quickly fix" someone else's file.
Before creating a new file, check that its folder is in your rows below. If it is not, ask Naveen where it goes.

| Area | Owner | Paths |
| --- | --- | --- |
| Database schema, migrations, roles and security, database tests | Naveen | `supabase/` |
| Database types and Supabase clients (everyone imports, only Naveen edits) | Naveen | `lib/supabase/`, `lib/db/` |
| Login and app shell | Naveen | `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/(auth)/`, `middleware.ts` |
| Technician phone link: token check and saving submissions | Naveen | `lib/field/` |
| Email intake (two mailboxes), WhatsApp intake and technician messages, AI extraction | Naveen | `n8n/`, `lib/ai/`, `lib/whatsapp/`, `app/api/` |
| Zoho Books, reminders, financial reports | Naveen | `lib/zoho/`, `app/(finance)/` |
| Management dashboard | Naveen | `app/dashboard/` |
| Dependencies, config, deployment, CI | Naveen | `package.json`, `package-lock.json`, `*.config.*`, `tsconfig.json`, `.env.example`, `.gitignore`, `.github/` |
| Office screens: customers, contacts, enquiries, quotations, jobs, POs, assignments | Pavana | `app/(office)/` (except `registers/`) |
| Office menu and page layout | Pavana | `app/(office)/layout.tsx` |
| Technician phone form (screens) | Pavana | `app/(field)/` |
| Reports: templates, required fields per method, review, approval, PDF, correction history view | Pavana | `app/(reports)/`, `templates/reports/`, `lib/reports/` |
| Shared UI components (others use them, ask Pavana for changes) | Pavana | `components/` |
| Qualification and equipment registers (screens) | Krishna | `app/(office)/registers/` |
| Test data, Excel import, smoke tests | Krishna | `scripts/seed/`, `scripts/import/`, `tests/` |
| Glossary, client inputs tracker, user guide | Krishna | `docs/GLOSSARY.md`, `docs/CLIENT_INPUTS.md`, `docs/guide/` |
| Shared docs: everyone edits only their own row, log entry or handoff | All | `docs/PROGRESS.md`, `docs/HANDOFF.md` |
| Project rules and plans | Naveen | `AGENTS.md`, `CLAUDE.md`, `docs/PROJECT_BRIEF.md`, `docs/WORK_PLAN.md`, `docs/DECISIONS.md` |

## Hard rules

1. **Never commit secrets.** Keys go in `.env.local`. Add each new variable name (no value) to `.env.example`.
2. **No real BITA data** in code, seeds, tests, screenshots or prompts to public tools. Use the data in `scripts/seed/`.
3. **Schema changes only through Naveen.** Migrations live in `supabase/migrations/`. Need a column or table? Write it under Requests in `docs/PROGRESS.md`.
4. **Zoho Books is the source of truth for money.** Never calculate GST or keep a ledger in our database. We store only mirrors: Zoho ids, invoice numbers, dates, amounts, status and balance.
5. **Every Zoho record carries the Job ID.** Before creating a proforma or invoice, check that the job has no `zoho_invoice_id` yet.
6. **No report leaves without a technical reviewer's approval.**
7. **Roles are enforced in the database** (Row Level Security), not only in the UI. Roles: `management`, `office`, `reviewer`, `technician`.
8. **Branches and pull requests.** Branch name `feature/<your-name>-<topic>`. Never push to `main`. One feature per pull request. Naveen reviews and merges.
9. **Before opening a pull request:** lint, type check and tests pass; screens checked at phone width (375 px); `docs/PROGRESS.md` updated.
10. **No new dependency** without a one-line reason. Only Naveen edits `package.json`: ask under Requests, he adds it on `main`, you pull.
11. **Do not invent business rules.** If unsure, write the question under **Open questions** in `docs/PROGRESS.md` and ask the human. Only Naveen contacts BITA.
12. The human must understand every change before it is committed. Explain changes in plain words in the pull request.
13. **Keep your branch fresh.** Every morning and before opening a pull request: `git fetch origin && git rebase origin/main`. Small pull requests, at least one per day, so nobody's work drifts.
14. **Use the database types.** Import table types from `lib/db/` and the Supabase client from `lib/supabase/`. Never copy them into your own folder.

## Conventions

- Job ID: `BITA/YY-YY/0001` (financial year, April to March). Pending BITA's confirmation.
- Job status values, in order: `enquiry_received`, `awaiting_approval`, `scheduled`, `inspection_done`, `report_in_review`, `report_sent`, `invoiced`, `closed`.
- Dates stored in UTC, shown in Asia/Kolkata time. Currency INR.
- Test methods: `UT`, `MPT`, `DPT`, `RT`, `VT`, `hardness`, `metallography`, `RLA`, `certification`, `general_inspection`.
