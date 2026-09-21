---
name: meeting-minutes
description: Read, summarize or write up qlda-viot meetings — schedule, discussion, action items, and attached images (whiteboard photos, screenshots). Use for "what meetings this week", "summarize meeting 42", "read the images in that meeting", "record the minutes / action items".
---

# Meetings (qlda-viot)

## Find a meeting
- `meeting_calendar` (`from`, `to`, optional `project_id`) — all projects incl. company-wide, grouped by day. Rows show `[meeting:ID]` (real, has/can have minutes) or `[series:ID]` (recurring occurrence, no minutes yet).
- `list_meetings` (project id) — a project's meetings with counts of opinions / actions / summary.
- `list_meeting_series` — recurring meeting definitions.

## Read one
`get_meeting` with the meeting id returns purpose, summary (tổng kết), discussion, action plan (owner + due), notes, and attached files. **Attached images come back inline — look at them** and fold what they show (whiteboard text, diagrams, screenshots) into your summary. Extra images beyond the limit are listed as `[att:ID]`; fetch them with `get_attachment`. Use `include_images: false` when only the text matters.

## Write up
1. Set purpose / summary with `update_meeting` (`purpose`, `summary`).
2. Record each discussion point or action with `add_meeting_action` (actions need an owner and due date; discussion points do not).
3. To turn an action into tracked work, create it with `add_task` and reference the meeting in the title.

Confirm the summary and action list with the user before writing — minutes are shared records.
