---
description: Run one unattended batch of the v4 ticket queue
agent: nightshift
---

Work through the v4 ticket queue in `docs/AUTONOMY.md` unattended, one ticket
per iteration, until the batch limit is reached or a stop condition fires.

You are the night-shift agent. Read `AGENTS.md`, `docs/AUTONOMY.md`, and the
newest `docs/SESSION_LOG.md` entry before starting. You cannot ask questions —
make conservative decisions and record them in the session log.

The objective is complete when:

- up to the batch limit of tickets have been processed, each one either
  `done` (all gates green, merged to `dev`, pushed, CI green, SESSION_LOG
  entry written, ticket status updated) or `blocked` (recorded with the exact
  failing gate output), **and**
- no commit or push was made to `main`, no release/tag was created, and no
  signing key was minted or overwritten, **and**
- the final reply contains the STATUS block with `NEXT:` set to the next
  ticket, or `none — stop conditions met`.

Stop conditions (any one ends the run):

- the batch limit in `docs/AUTONOMY.md` is reached;
- two consecutive tickets block;
- the queue is empty;
- `dev` CI is red and cannot be made green in three attempts;
- a signing key, main branch or release guard would have to be overridden.

Never claim TV verification. Never touch `docs/REFINED_UX_REPORT.md`.
