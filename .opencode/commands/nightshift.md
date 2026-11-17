---
description: Run one unattended development batch during the 13:30-19:30 Dhaka window
agent: nightshift
---

Work through the v4 ticket queue in `docs/AUTONOMY.md` unattended, one ticket
per iteration, until the batch limit is reached, the queue is empty, or the
clock passes 19:30 Asia/Dhaka — whichever comes first. You cannot ask anyone
anything; decide conservatively and record the decision in the session log.

The objective is complete when:

- up to BATCH_LIMIT tickets have been processed, each either `done` (all gates
  green, merged to `dev`, pushed, CI green, session log written, ticket status
  updated) or `blocked` (recorded with the exact gate output, `NEXT` advanced);
- a blocked ticket never ended the run and no step waited for a decision;
- no commit or push was made to `main`, no release/tag, no signing key change;
- the final reply contains the STATUS block with `NEXT` set to the next ticket
  or `none — stop conditions met`.

Stop conditions: batch limit; 19:30 Dhaka reached; queue empty; a hard policy
would have to be overridden. Never claim TV verification. Never touch
`docs/REFINED_UX_REPORT.md`. The post-commit hook writes
`docs/AUTONOMY_REPORT.md` after every commit — do not write it yourself.
