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

_None yet._
