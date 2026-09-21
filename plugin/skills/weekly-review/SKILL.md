---
name: weekly-review
description: Plan or review the user's week in qlda-viot — what to focus on, weekly goals vs. progress, team priorities, unread notifications. Use for "what should I work on", "plan my week", "weekly review", "how am I doing this week".
---

# Weekly review (qlda-viot)

Use the viot-tasktisk MCP tools (any prefix — match by tool name).

1. `dashboard` — overdue / due today / this week / later, plus team weekly priorities. Start here.
2. `week_goals` with `action: "list"`, `mine_only: true` — personal goals for the current ISO week and their `pct`.
3. `week_priorities` with `action: "list"` — group/project-level priorities set by the PM (rank 1 = highest). Different from goals: priorities are the team's, goals are personal.
4. `my_items` — Items assigned to the user even when none of their child Tasks are.
5. `notifications` with `unread_only: true` — anything that changes the plan (new assignments, mentions).

## Output

Keep it short, in the user's language:
- **Do first**: overdue, then due today, then anything matching a rank-1 priority.
- **Goals**: each goal with its %, flag those at 0% while the week is mostly over.
- **Risks**: overdue items, `Need help` statuses, items with no due date.
- **Suggested changes** (reschedule, add a goal): propose, and only call `update_work` / `week_goals` (`add`/`update`) after the user agrees.

Mentions of `task:N` / `item:N` in tool output are IDs you can pass to `get_item` / `update_work`.
