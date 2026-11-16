# Night-shift task prompt

This is the prompt for the `nightshift` scheduled task. It is deliberately
plain text, **not** the `/nightshift` slash command.

> **Why not a slash command:** OpenChamber's scheduler detects a prompt that
> starts with `/` and routes it through `session.command`, which on v2.0.8
> fails with `Missing key at ["name"]` before the agent ever runs. A plain-text
> prompt goes through `session.prompt` and works. The live task on this machine
> failed four times with that error until the prompt was changed. Keep it plain.

Keep this file and the live task in sync. On the first night this exact text
ran a successful batch: T-130, T-131 and T-132 merged green in ~16 minutes.

## Prompt

```
Run one unattended night-shift batch. Read AGENTS.md, docs/AUTONOMY.md, and the newest docs/SESSION_LOG.md entry first. Work through up to the BATCH_LIMIT tickets from the queue, one branch and one green merge to dev per ticket, all gates green before each commit, append a SESSION_LOG entry for each, and stop on the documented stop conditions. Never touch main, run release, create tags, or mint a signing key. End your reply with the STATUS block (TICKET / STATE / BRANCH-CI / NEXT).
```

## Live task settings (this machine, OpenChamber 2.0.8)

Set through `PUT /api/projects/<id>/scheduled-tasks`. Machine-side, not in git.

| Field | Value |
|---|---|
| name | `nightshift` |
| enabled | `true` |
| schedule | cron `35 23 * * *` (11:35 PM Bangladesh time) |
| timezone | `Asia/Dhaka` (UTC+6) |
| prompt | the text above |
| provider / model | `opencode` / `hy4-flash-free` |
| agent | `nightshift` |
| goalEnabled | `true` |
| goalTokenBudget | `400000` |

The first line of the prompt says to read this file indirectly via
`docs/AUTONOMY.md`; the queue, stop conditions and hard rules live there.
