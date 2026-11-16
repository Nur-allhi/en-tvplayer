---
name: nightshift
schedule: "35 23 * * *"
enabled: true
model: opencode/hy4-flash-free
agent: nightshift
timezone: Asia/Dhaka
---

Run one unattended night-shift batch. Read AGENTS.md, docs/AUTONOMY.md, and the newest docs/SESSION_LOG.md entry first. Work through up to the BATCH_LIMIT tickets from the queue, one branch and one green merge to dev per ticket, all gates green before each commit, append a SESSION_LOG entry for each, and stop on the documented stop conditions. Never touch main, run release, create tags, or mint a signing key. End your reply with the STATUS block (TICKET / STATE / BRANCH-CI / NEXT).
