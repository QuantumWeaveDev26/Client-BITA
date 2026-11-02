# Decisions log

Newest at the bottom. Each decision: what was decided, why, who decided, date. Never delete an entry; add a new one that replaces it.

| ID | Date | Decision | Why | Decided by |
| --- | --- | --- | --- | --- |
| D-001 | 2026-11-02 | Zoho Books is the single source of truth for accounting. GST, GSTR filing, e-invoicing, e-way bills and financial reports stay in Zoho. We sync contacts, proformas, invoices and payment status only. | Client requirement (section 7); avoids building tax logic | Naveen |
| D-002 | 2026-11-02 | Stack: Next.js, Supabase, n8n, Claude API, Zoho Books API. | Fast to build, one database, integrations without custom servers | Naveen |
| D-003 | 2026-11-02 | One-week build, Tue 3 to Mon 9 Nov (Mon to Fri). Internal target: ready Tue 10 Nov. | Room for BITA's review and training without rushing | Naveen |
| D-004 | 2026-11-02 | WhatsApp enquiries are logged by office staff until BITA's Meta business verification is approved; then auto-capture is switched on. | Meta verification is outside our control | Naveen |
| D-005 | 2026-11-02 | No report reaches a customer without technical reviewer approval, including AI-drafted reports. | Reports are BITA's legal product | Naveen |
| D-006 | 2026-11-02 | Database schema and migrations are owned by Naveen; others request changes. | Avoid conflicting migrations | Naveen |
| D-007 | 2026-11-02 | All project context lives in this repo (`AGENTS.md`, `docs/`). Task status lives in TeamSync. Nothing important lives only in a chat. | Team switches between Codex, Claude and accounts | Naveen |
