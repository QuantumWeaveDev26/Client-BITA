# Agent protocol – Claude Code, Apollo and Atlas working together

Naveen's three agents build the BITA system together on the October canvas. Any agent must be able to continue
another's work at any moment, for example when one runs out of credits. This file is the working agreement.

## 1. Where shared knowledge lives

| Place | What | Visible to |
| --- | --- | --- |
| `C:\BITA-shared\` (outside the repo, never pushed) | `README.md`, `STATE.md` (live board and task claims), `LOG.md` (every step), `KNOWLEDGE.md` (client, dates, price, rules, infrastructure), `handoffs/<task>.md` | Naveen's agents only |
| This repo | `AGENTS.md`, `docs/` (progress, decisions, handoffs, plans), code | Everyone with repo access |

Start every session by reading `C:\BITA-shared\README.md` and following its read order.

## 2. Claim before you build

- Take a task only from the queue in `STATE.md`, and only when its **Needs** are done.
- Write your agent name as **Owner** and set your row to `active` **before** writing any code. One owner per task.
- Never edit files that belong to another agent's active task. If you need to, ask on the October bus (`message_peer`) or write it under Requests in `docs/PROGRESS.md`.

## 3. One worktree per agent

Agents share this machine, so `git checkout` in one folder changes files under the others. Each agent works in its own git worktree:

```bash
git -C C:/BITA worktree add C:/BITA-wt/<agent> -b feature/naveen-<topic> origin/main
```

`C:\BITA` itself belongs to Claude Code. Copy `.env.local` into your worktree, and run `npm install` there. Run the dev server on your own port (`npm run dev -- -p 3001` for Apollo, `3002` for Atlas).

## 4. Write before you work, write after you work

Credits can end mid-step without warning. So, for every step (a step is roughly 15–30 minutes of work):

1. **Before:** one `START` line in `LOG.md`; your row in `STATE.md` updated.
2. **After:** one `DONE` line in `LOG.md`; update `C:\BITA-shared\handoffs/<task>.md` (done so far, **the very next step**, files touched, open problems); commit and **push** your branch, work in progress included (commit message `WIP: …` is fine).
3. Re-read `STATE.md` just before editing it, and change only your own row and your task's lines.

## 5. Taking over

An agent is stopped when its row says `stopped`, or it shows `active` with no update for 30 minutes and it doesn't answer on the bus.

1. Set its row to `stopped` (if not already), then claim its task.
2. Read `handoffs/<task>.md` and the last `LOG.md` entries for that task.
3. `git fetch` and check out its branch in **your** worktree. Its last push is the latest work.
4. Log `START · <task> · taking over from <agent>` and continue from "the very next step".

## 6. Rules every agent follows

Everything in `AGENTS.md`, plus these from `KNOWLEDGE.md` section 2:

- Commits are authored only as `Naveen Reddy <naveenreddy95190@gmail.com>`, with no `Co-Authored-By` and no AI attribution, in commits and PRs.
- Only Naveen talks to BITA. Ask him before anything client-facing.
- No real BITA data in the repo.
- Never type or store passwords.
- Schema changes: add the migration file **and** apply it to `bita-dev`, then regenerate `lib/db/types.ts`. Only one agent changes the schema at a time; claim the task that needs it.
- Naveen merges pull requests, or tells an agent to.
