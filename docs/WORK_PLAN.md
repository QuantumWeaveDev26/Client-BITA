# Work plan – who does what, and how we work

Revised Thu 5 Nov (D-014): **Naveen builds all the code. Krishna supports with test data, testing and documents, no code.**
Delivery comes in two stages. Stage 1 is the core system. Stage 2 is the parts that wait for BITA's access (Zoho Books, mailboxes) and Meta's WhatsApp verification.
BITA's requirements (R1–R41, X1–X4) are summarised in `docs/PROJECT_BRIEF.md` section 3.

## 1. Who does what

| Person | Does | TeamSync tasks |
| --- | --- | --- |
| **Naveen** | All application code: database, login, every screen, technician phone form, reports and PDFs, registers, dashboard, email and WhatsApp intake, Zoho Books, reminders, financial reports, import, deployment. All contact with BITA. | 13–22, 26, 49–52 |
| **Krishna** | Glossary, fake test data, client inputs tracker, testing what Naveen merges each day (bug list), user guide | 23, 24, 25, 27, 28 |

## 2. Stage 1: core system

| Day | Naveen | Krishna |
| --- | --- | --- |
| **Thu 5 Nov** | Done: app skeleton, database with roles and correction log, dev database `bita-dev`, database types | Set up (section 4). Glossary. Start test data. |
| **Fri 6 Nov** | Login and storage. Customers and contacts. Enquiries (phone, WhatsApp and email entered by hand). Load Krishna's test data. | Finish `scripts/seed/seed.sql`. `docs/CLIENT_INPUTS.md` with the 30 items asked on 5 Nov. |
| **Mon 9 Nov** | Quotations: BITA letterhead PDF, items, past-rate search, management approval. Jobs, PO, Job ID page. | Test customers, enquiries, login. Bug list. |
| **Tue 10 Nov** | Qualification and equipment registers. Technician assignment with expiry warning. Technician phone link and form, with missing-reading checks. | Test quotations and jobs. Update the tracker with BITA's answers. |
| **Wed 11 Nov** | UT, MT and DPT reports in BITA's formats, review and approval, signed PDF, sending, correction history. | Test registers, assignment, phone form at phone width. |
| **Thu 12 Nov** | Dashboard (active jobs, pending reports, outstanding). Email capture if mailbox access has arrived. Deployment. Full test on one job. | Test reports end to end. First draft of the user guide. |

## 3. Stage 2: after BITA's access arrives (from Mon 16 Nov)

| Part | Waits for |
| --- | --- |
| Email capture from both mailboxes (if not done in stage 1) | Mailbox access |
| Zoho Books: contacts, proforma (TDPS), GST invoice, payment status, reminders | BITA's Zoho migration and access |
| WhatsApp enquiries and the technician WhatsApp workflow (R3, X1) | BITA's WhatsApp Business number and Meta verification |
| Financial reports from Zoho (X4) | Zoho access |
| Import of BITA's real customer list; training; final user guide | Stage 1 accepted |

## 4. Krishna: first-time setup and daily routine

1. Install Node.js 20+ and Git. Accept the GitHub invitation to `QuantumWeaveDev26/client-bita`.
2. `git clone https://github.com/QuantumWeaveDev26/client-bita.git`, `cd client-bita`, `npm install`.
3. Put the `.env.local` Naveen sends you privately into the project folder. Run `npm test`, then `npm run dev` and open http://localhost:3000.
4. Branch `feature/krishna-<topic>`. Open Codex in the folder and paste your kick-off prompt from `docs/HANDOFF.md`.
5. Every evening: pull `main`, test what was merged that day (laptop and phone width), and write bugs under **Bugs** in `docs/PROGRESS.md` with the steps to repeat them.
6. Edit only your files (`AGENTS.md`, "Who owns which folder"). Never real BITA data.

## 5. Naveen: how each session runs

1. `git checkout main && git pull`, then a branch `feature/naveen-<topic>`.
2. Start the coding agent with the session-start prompt in `docs/HANDOFF.md`.
3. One feature per pull request. Before merging: lint, type check, tests, phone width (375 px), `docs/PROGRESS.md` updated.
4. Merge, then tell Krishna what to test that evening.
5. Before stopping: the session-end prompt in `docs/HANDOFF.md`.

## 6. Communication rules

- Only Naveen talks to BITA. Questions for the client go under **Open questions** in `docs/PROGRESS.md`.
- Krishna needs something in code? Write it under **Requests** in `docs/PROGRESS.md` and tell Naveen.
- Decisions that change how something works go in `docs/DECISIONS.md`.

## 7. Definition of done for any feature

- [ ] Works on laptop and phone width
- [ ] Respects roles (only management approves quotations; only a reviewer approves reports)
- [ ] Uses test data only
- [ ] Lint, type check and tests pass
- [ ] `docs/PROGRESS.md` updated
- [ ] Tested by Krishna the same evening
- [ ] TeamSync task marked done
