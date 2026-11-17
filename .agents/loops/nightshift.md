---
name: nightshift
schedule: "30 13 * * *"
enabled: true
model: opencode/hy4-flash-free
agent: nightshift
timezone: Asia/Dhaka
---

Run one unattended development batch. Read AGENTS.md, docs/AUTONOMY.md, and the newest docs/SESSION_LOG.md entry first. The operating window is 13:30 to 19:30 Asia/Dhaka — check the clock before each ticket and stop starting new work at 19:30. Work through up to BATCH_LIMIT tickets from the queue: one branch, all gates green, one merge to dev per ticket, session log entry for each, and continue past blocked tickets without ever waiting for a decision or a reply. On a gate failure retry up to three times with a genuine fix, then mark the ticket blocked and move on. Use the read-only scout subagent before any ticket that moves more than five functions. Every commit is reported automatically to docs/AUTONOMY_REPORT.md by the post-commit hook. Never touch main, run release, create tags, or mint a signing key. End your reply with the STATUS block (TICKET / STATE / BRANCH-CI / NEXT).
