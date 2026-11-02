# Work plan – who does what, and how we work

Team: **Naveen** (lead), **Pavana**, **Krishna**. Build starts Tue 3 Nov. Internal target: ready for delivery Tue 10 Nov.
Everyone reads this whole file, not only their own section, so each person knows what the others are doing.

## 1. Who owns what

| Person | Owns | Why |
| --- | --- | --- |
| **Naveen** (lead) | Client communication with BITA, database schema and security, logins and roles, Zoho Books integration, email intake and AI extraction, AI report drafting, payment reminders, dashboard, deployment, review and merge of every pull request | These parts touch money, client data and the foundations everything else depends on |
| **Pavana** | Office screens (customers, enquiries, jobs, quotations, POs, scheduling), technician field form, report templates, review and approval screens, report PDFs | Complete modules, visible to the client in every demo |
| **Krishna** | Glossary, test data, client inputs tracker, Excel import, automated smoke tests, daily testing, user guide | Clear tasks that teach the whole system without risk to money or security |

## 2. Day-by-day plan

| Day | Naveen | Pavana | Krishna |
| --- | --- | --- | --- |
| **Tue 3 Nov** | Repo setup, protected `main`, database tables, roles and security, n8n workspace, access for team; follow up BITA's priority inputs; email intake + AI extraction flow | Customer and enquiry screens (on mock data until the schema is merged, then switch); new vs existing customer check | `docs/GLOSSARY.md`; seed data (10 customers, 20 enquiries, sample jobs); start `docs/CLIENT_INPUTS.md` tracker |
| **Wed 4 Nov** | Schema for jobs, quotations, POs, schedules; Zoho Books connection and contact sync | Jobs, PO upload, quotation flow and PDF, Job ID, scheduling with technician allocation and clash warning | Test Tuesday's work; log bugs; update inputs tracker; start smoke tests for the enquiry flow |
| **Thu 5 Nov** | AI report drafting from field data; Zoho estimates (proforma); review Pavana's pull requests | Technician field form (phone first); UT, MPT and DPT report templates from BITA's samples | Excel import script (dummy file until BITA's lists arrive); test Wednesday's work |
| **Fri 6 Nov** | GST invoice conversion, payment and balance sync, reminders, job closure; dashboard | Review and approval screens; final report PDF with logo and signature; email to customer; other templates as samples arrive | Test Thursday's work; first draft of the user guide with screenshots |
| **Mon 9 Nov** | Full test on one real BITA job end to end; check Zoho figures match exactly; production deployment and backups | Fix UI bugs from testing; finish remaining templates | Run all smoke tests; finish user guide for each role; import BITA's real lists (with Naveen) |
| **Tue 10 Nov** | Final checks; training plan | Final fixes | Training material ready |

## 3. Who waits for whom

- Pavana's screens need Naveen's schema. **Naveen merges the schema by Tue 3 Nov lunchtime.** Until then Pavana builds on mock data.
- Report templates need BITA's sample reports. Krishna tells the team the moment a sample arrives.
- Zoho work needs BITA's Zoho admin. If access is late, Naveen builds against a Zoho Books trial organisation and switches later.
- Krishna's tests follow whatever was merged the day before.

## 4. Daily rhythm

| Time | What |
| --- | --- |
| 10:00 | 15-minute stand-up: what I finished, what I'm doing today, what's blocking me |
| During the day | Work on your branch with your coding agent; ask in the team group after 30 minutes stuck |
| By 17:00 | Open pull requests for the day's work so Naveen can review |
| End of day | Update `docs/PROGRESS.md`, write a handoff if unfinished, post a TeamSync check-in |
| Evening | Krishna tests what was merged that day |

## 5. How to work with a coding agent (Codex or Claude), step by step

1. Pick your task in TeamSync. Make sure it is yours and not blocked.
2. Update your local copy: `git checkout main && git pull`.
3. Create a branch: `git checkout -b feature/<your-name>-<topic>`, for example `feature/pavana-enquiry-screens`.
4. Start the agent with the **session-start prompt** in `docs/HANDOFF.md`. It makes the agent read `AGENTS.md`, `PROGRESS.md`, the latest handoff and this plan before working.
5. Ask the agent for a short plan first. Check it matches the task and stays inside your folders. Then let it build in small steps.
6. Run the app and try the feature yourself, including at phone width. Make sure you understand what changed.
7. Run lint, type check and tests. Fix anything that fails.
8. Commit with a clear message, for example `Add enquiry list and new-customer check`.
9. Before ending, ask the agent to run the **session-end prompt** in `docs/HANDOFF.md`. It updates `PROGRESS.md` and writes a handoff.
10. Push and open a pull request using the template. Tag Naveen.
11. Post a TeamSync check-in: what you did, what's next, any blocker.

**Switching agents or accounts** (credits ran out, switching Claude to Codex, new conversation): finish step 9 first. The new agent starts from step 4 and picks up from the handoff. Nothing lives only inside a chat.

## 6. Communication rules

- Only Naveen talks to BITA. Questions for the client go under **Open questions** in `docs/PROGRESS.md`.
- Need something in someone else's area? Write it under **Requests** in `docs/PROGRESS.md` and tell them in the group.
- Blocked for more than 30 minutes? Say so in the group and add it under **Blockers**.
- Decisions that change how something works go in `docs/DECISIONS.md` with the reason.

## 7. Definition of done for any task

- [ ] Works on laptop and phone width
- [ ] Respects roles (a technician cannot see invoices, and so on)
- [ ] Uses test data only
- [ ] Lint, type check and tests pass
- [ ] `docs/PROGRESS.md` updated
- [ ] Pull request reviewed and merged by Naveen
- [ ] TeamSync task marked done
