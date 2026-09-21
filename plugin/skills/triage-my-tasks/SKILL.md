---
name: triage-my-tasks
description: Update task/item status, due dates, priorities and log time in qlda-viot. Use for "mark task 123 done", "move X to next week", "log 2h on task N", "what did I log this week", "add a task to item N".
---

# Triage and update work (qlda-viot)

Find IDs first — never guess them. `dashboard` shows `task:N`; `my_items` and `get_item` show items and their tasks.

| Goal | Tool |
|---|---|
| Change status / due / priority | `update_work` (`kind: "task"` or `"item"`, plus `id`, `status`) |
| Add a task under an item | `add_task` |
| Log time on a task | `log_time` (`action: "log"`, `task_id`, `minutes`) |
| Review / fix logged time | `log_time` (`action: "list"` with `from`/`to`, then `update`/`delete`) |
| Comment (notifies the assignee; `@Name` mentions) | `comment` |

## Rules

- Task statuses: Plan · Todo · Doing · Done · Close · Need help. Item statuses: Todo · Doing · Review · Done · Cancelled. Use them exactly.
- Priority values are `Cao` / `TB` / `Thấp`; dates are `YYYY-MM-DD`.
- Time is in **minutes** for `log_time` — convert "1.5h" to 90.
- For bulk changes, list what you will change and get a yes before the first write. After writing, re-run `get_item` or `dashboard` to confirm.
- Work that belongs to no project (R&D, training, meetings) goes under the `internal` bucket shown by `list_projects`.
