# Work plan – who does what, and how we work

Team: **Naveen** (lead), **Pavana**, **Krishna**. Internal target: ready for delivery **Tue 10 Nov**.
Plan revised on Thu 5 Nov after BITA's requirements document (R1–R41, X1–X4; summary in `docs/PROJECT_BRIEF.md` section 3).
Everyone reads this whole file, not only their own section, so each person knows what the others are doing.

## 0. First time only: get set up (each person, about 20 minutes)

1. Install **Node.js 20 or newer** and **Git**. Accept Naveen's GitHub invitation to `QuantumWeaveDev26/client-bita`.
2. `git clone https://github.com/QuantumWeaveDev26/client-bita.git` and `cd client-bita`.
3. `npm install`
4. Get the **dev `.env.local`** from Naveen (sent privately, never by email or in the group). Put it in the project folder. It is ignored by git.
5. Check everything works: `npm test` (database tests pass), then `npm run dev` and open http://localhost:3000.
6. Create your first branch (see your section below), open Codex in the project folder, and paste your **kick-off prompt** from `docs/HANDOFF.md`.

Codex reads `AGENTS.md` automatically. Claude reads it through `CLAUDE.md`. Both follow the same rules.

## 1. Who owns what

The exact folders each person owns are in the table in `AGENTS.md` ("Who owns which folder"). **Only the owner edits a file.** That is the whole coordination rule.

| Person | Owns | TeamSync tasks |
| --- | --- | --- |
| **Naveen** (lead) | Database, logins and security; the technician phone-link backend; email intake from both mailboxes; WhatsApp intake and technician messages; Zoho Books; reminders; dashboard; financial reports; dependencies and deployment; reviewing and merging every pull request; all contact with BITA | 13, 14, 15, 16, 17, 18, 49, 50 |
| **Pavana** | Every office screen (customers, enquiries, quotations, jobs, POs, assignments), the technician phone form screens, report templates, review and approval, report PDFs, the correction history view, shared UI components | 19, 20, 21, 22, 52 |
| **Krishna** | Glossary, test data, client inputs tracker, qualification and equipment register screens, Excel import, smoke tests, daily testing, user guide | 23, 24, 25, 26, 27, 28, 51 |

## 2. Day-by-day plan

| Day | Naveen | Pavana | Krishna |
| --- | --- | --- | --- |
| **Thu 5 Nov** | Merge the setup PR. Create the dev Supabase project, apply the migration, send `.env.local` privately. Generate `lib/db/types.ts`. Invite Pavana and Krishna to GitHub. | Set up (section 0). Branch `feature/pavana-customers`. Office layout and menu, customer list and customer page with contacts (on Krishna's test data, or typed mock data until it lands). | Set up (section 0). Branch `feature/krishna-test-data`. `docs/GLOSSARY.md`; test data in `scripts/seed/` (fake values in BITA's shapes); `docs/CLIENT_INPUTS.md` with the 30 items asked on 5 Nov. |
| **Fri 6 Nov** | Login page and roles. Storage buckets. `lib/field/` (phone-link token check and saving a submission). Email intake for both mailboxes. | Enquiries list and entry (email, phone, WhatsApp). Quotations: letterhead PDF in BITA's style, items, past-rate search, approval by management. | Branch `feature/krishna-registers`. Qualification register (method by method, certificate copy, expiry flag) and equipment register (4 UT machines, 2 yokes). |
| **Sat 7 / Sun 8** | BITA's answers due Sat 7. Naveen updates the tracker items with Krishna on Monday. | – | – |
| **Mon 9 Nov** | Zoho Books: contacts, proforma (TDPS), GST invoice, payment sync. Reminders. Dashboard (3 numbers). WhatsApp intake once BITA's number is ready. | Jobs, PO, assignment with the qualification check (uses Krishna's register). Technician phone form with missing-reading checks. UT, MT and DPT report templates. | Customer import script (`scripts/import/`), run locally only. Smoke tests for customers, enquiries, quotations. Test everything merged so far. |
| **Tue 10 Nov** | Financial reports from Zoho. End-to-end test on one job. Deployment. | Review and approval screens, signed PDF after approval, sending to the customer, correction history view. Fix bugs. | User guide (2 office users, plus a one-page WhatsApp guide for technicians). Final test run, bug list. |

## 3. Who waits for whom (and what to do meanwhile)

| You need | From | Ready by | Until then |
| --- | --- | --- | --- |
| `.env.local` and the dev database | Naveen | Thu 5 evening | Pavana: build screens with typed mock data. Krishna: write the glossary and test data files. |
| `lib/db/types.ts` (table types) | Naveen | Thu 5 evening | Use the column names in `supabase/migrations/`. Never edit the migration. |
| Test data loaded in the dev database | Krishna | Thu 5 / Fri 6 | Pavana uses mock data in her own folder, then deletes it. |
| Login page | Naveen | Fri 6 | Screens can be built and checked without login on the dev database. |
| `lib/field/` (token check, save submission) | Naveen | Fri 6 | Pavana builds the phone form screens against a mock function with the same name. |
| Qualification register data | Krishna | Fri 6 | Pavana shows "qualification not found" in the assignment screen. |
| BITA's report formats (UT, MT, DPT samples and blanks, logo, seal, signatures) | Naveen, shared privately | Thu 5 | They are real client files: keep them **outside** the repo folder. |
| Mailbox, Zoho and WhatsApp access | BITA | Asked 5 Nov, due Sat 7 | Naveen builds against test mailboxes and a Zoho trial organisation. |

## 4. Daily rhythm

| Time | What |
| --- | --- |
| 10:00 | 15-minute stand-up: what I finished, what I'm doing today, what's blocking me |
| Start of your session | `git fetch origin && git rebase origin/main` on your branch, then the session-start prompt in `docs/HANDOFF.md` |
| During the day | Work only in your folders with your coding agent; ask in the team group after 30 minutes stuck |
| By 17:00 | Open a pull request for the day's work (small is fine) so Naveen can review and merge the same evening |
| End of day | Session-end prompt: update `docs/PROGRESS.md`, write a handoff if unfinished, post a TeamSync check-in |
| Evening | Krishna tests what was merged that day |

## 5. How to work with a coding agent (Codex or Claude), step by step

1. Pick your task in TeamSync. Make sure it is yours and not blocked.
2. Update your local copy: `git checkout main && git pull`.
3. Create a branch: `git checkout -b feature/<your-name>-<topic>`, for example `feature/pavana-customers`.
4. Start the agent with your **kick-off prompt** (first time) or the **session-start prompt** (every later session) from `docs/HANDOFF.md`.
5. Ask the agent for a short plan first. Check it matches the task and **stays inside your folders**. Then let it build in small steps.
6. Run the app and try the feature yourself, including at phone width (375 px). Make sure you understand what changed.
7. Run `npm run lint`, `npm run typecheck` and `npm test`. Fix anything that fails.
8. Commit with a clear message, for example `Add customer list and contacts`.
9. Before ending, run the **session-end prompt** in `docs/HANDOFF.md`. It updates `PROGRESS.md` and writes a handoff.
10. Push and open a pull request using the template. Tag Naveen.
11. Post a TeamSync check-in: what you did, what's next, any blocker.

**Switching agents or accounts** (credits ran out, switching Claude to Codex, new conversation): finish step 9 first. The new agent starts from step 4 and picks up from the handoff. Nothing lives only inside a chat.

**If the agent wants to edit a file outside your folders: stop it.** Write a request under Requests in `docs/PROGRESS.md` instead and tell the owner in the group.

## 6. Communication rules

- Only Naveen talks to BITA. Questions for the client go under **Open questions** in `docs/PROGRESS.md`.
- Need something in someone else's area? Write it under **Requests** in `docs/PROGRESS.md` and tell them in the group.
- Blocked for more than 30 minutes? Say so in the group and add it under **Blockers**.
- Decisions that change how something works go in `docs/DECISIONS.md` (Naveen adds them; suggest them under Requests).

## 7. Definition of done for any task

- [ ] Works on laptop and phone width
- [ ] Respects roles (only management approves quotations; only a reviewer approves reports)
- [ ] Uses test data only
- [ ] Only files in my folders changed
- [ ] Lint, type check and tests pass
- [ ] `docs/PROGRESS.md` updated
- [ ] Pull request reviewed and merged by Naveen
- [ ] TeamSync task marked done
