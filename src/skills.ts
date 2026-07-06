import type { User } from './api.js';
import { getUpdateAvailable, getLocalVersion } from './update.js';

// ---- Types mirrored from qlda-viot domain ----

interface TaskWithMeta {
  id: number;
  title: string;
  status: string | null;
  due: string | null;
  priority: string | null;
  done_at: string | null;
  pname?: string;
  feature_name?: string;
  item_title?: string;
  assignee_name?: string;
}

interface Task {
  id: number;
  title: string;
  status: string | null;
  due: string | null;
  priority: string | null;
  done_at: string | null;
}

interface ItemWithTasks {
  id: number;
  title: string;
  type: string;
  status: string;
  priority: string;
  feature_name?: string;
  sprint_name?: string | null;
  assignee_name?: string | null;
  reporter?: number | null;
  task_total: number;
  task_done: number;
  task_pct: number;
  description?: string | null;
  acceptance_criteria?: string | null;
  tasks?: Task[];
}

interface PublicUser {
  id: number;
  name: string;
  role: string;
}

interface Notification {
  id: number;
  user_id: number;
  type: string;
  ref_type: string | null;
  ref_id: number | null;
  body: string;
  read_at: string | null;
  created: string;
}

interface TaskLog {
  id: number;
  task_id: number;
  user_id: number;
  date: string;
  minutes: number;
  note: string | null;
  created: string | null;
}

interface Attachment {
  id: number;
  project_id: number;
  etype: string;
  eid: number;
  kind: string;
  name: string | null;
  text: string | null;
  created: string | null;
  user_id: number | null;
}

interface WeeklyPriorityItem {
  id: number;
  rank: number;
  note: string | null;
  project_name?: string;
  project_customer?: string;
}

interface PrioritiesRes {
  week: string;
  items: WeeklyPriorityItem[];
}

type ApiFn = <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>;

// ---- Helpers ----

function currentWeek(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekEndStr(): string {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + (7 - day));
  return d.toISOString().slice(0, 10);
}

function fmtTask(t: TaskWithMeta): string {
  const parts: string[] = [`[task:${t.id}] ${t.title}`, `(${t.status ?? 'Todo'})`];
  if (t.pname) parts.push(`· proj:${t.pname}`);
  if (t.feature_name) parts.push(`> feat:${t.feature_name}`);
  if (t.item_title) parts.push(`> item:${t.item_title}`);
  if (t.due) parts.push(`due:${t.due}`);
  if (t.priority === 'Cao') parts.push('[HIGH]');
  return parts.join(' ');
}

// ---- Skills ----

export async function dashboard(apiFn: ApiFn, me: User | null): Promise<string> {
  const [tasks, prio] = await Promise.all([
    apiFn<TaskWithMeta[]>('GET', '/mytasks'),
    apiFn<PrioritiesRes>('GET', `/priorities?week=${currentWeek()}`).catch(
      () => ({ week: currentWeek(), items: [] } satisfies PrioritiesRes)
    ),
  ]);

  const tod = todayStr();
  const wend = weekEndStr();
  const doneStatuses = new Set(['Done', 'Close', 'Cancelled']);

  const active = tasks.filter(t => !doneStatuses.has(t.status ?? ''));
  const overdue  = active.filter(t => t.due && t.due < tod);
  const dueToday = active.filter(t => t.due === tod);
  const dueWeek  = active.filter(t => t.due && t.due > tod && t.due <= wend);
  const later    = active.filter(t => !t.due || t.due > wend);
  const finished = tasks.filter(t => doneStatuses.has(t.status ?? ''));

  const newVersion = getUpdateAvailable();
  const lines: string[] = [
    `# Dashboard — ${me?.name ?? 'Me'} · ${tod} (${prio.week})`,
    ...(newVersion
      ? [`\n> ⬆️  Update available: ${getLocalVersion()} → **${newVersion}** — run \`viot-tasktisk update\` then restart Claude Desktop.`]
      : []),
    '',
  ];

  if (overdue.length) {
    lines.push(`## 🔴 Overdue (${overdue.length})`);
    overdue.forEach(t => lines.push('- ' + fmtTask(t)));
    lines.push('');
  }
  if (dueToday.length) {
    lines.push(`## 🟡 Due Today (${dueToday.length})`);
    dueToday.forEach(t => lines.push('- ' + fmtTask(t)));
    lines.push('');
  }
  if (dueWeek.length) {
    lines.push(`## 🟢 This Week (${dueWeek.length})`);
    dueWeek.forEach(t => lines.push('- ' + fmtTask(t)));
    lines.push('');
  }
  if (later.length) {
    lines.push(`## ⬜ Later / No Due (${later.length})`);
    later.forEach(t => lines.push('- ' + fmtTask(t)));
    lines.push('');
  }
  if (finished.length) {
    lines.push(`## ✅ Done / Closed (${finished.length})`);
    finished.forEach(t => lines.push('- ' + fmtTask(t)));
    lines.push('');
  }
  if (!tasks.length) lines.push('_No tasks assigned to you._');

  const prioItems = prio.items ?? [];
  if (prioItems.length) {
    lines.push(`## 📌 Weekly Priorities (${prio.week})`);
    [...prioItems]
      .sort((a, b) => a.rank - b.rank)
      .forEach(p => {
        const label = p.project_name ?? '—';
        const note = p.note ? ` — ${p.note}` : '';
        lines.push(`${p.rank}. ${label}${note}`);
      });
  }

  return lines.join('\n');
}

export interface UpdateWorkArgs {
  id: number;
  kind: 'task' | 'item';
  status: string;
  due?: string;
  priority?: string;
}

export async function updateWork(apiFn: ApiFn, args: UpdateWorkArgs): Promise<string> {
  const { id, kind, status, due, priority } = args;
  const path = kind === 'task' ? `/tasks/${id}` : `/items/${id}`;
  const patch: Record<string, unknown> = { status };
  if (due !== undefined) patch.due = due;
  if (priority !== undefined) patch.priority = priority;
  const result = await apiFn<TaskWithMeta>('PATCH', path, patch);
  const parts = [`Updated ${kind} #${id} → ${result.status ?? status}`];
  if (result.due) parts.push(`due:${result.due}`);
  if (result.priority) parts.push(`priority:${result.priority}`);
  if (result.done_at) parts.push(`done_at:${result.done_at}`);
  return parts.join(' · ');
}

export interface AddTaskArgs {
  item_id: number;
  title: string;
  descr?: string;
  due?: string;
  priority?: string;
  assignee?: number;
}

export async function addTask(apiFn: ApiFn, args: AddTaskArgs): Promise<string> {
  const { item_id, title, descr, due, priority, assignee } = args;
  const payload: Record<string, unknown> = { title };
  if (descr) payload.descr = descr;
  if (due) payload.due = due;
  if (priority) payload.priority = priority;
  if (assignee != null) payload.assignee = assignee;
  const task = await apiFn<Task>('POST', `/items/${item_id}/tasks`, payload);
  return `Created task #${task.id}: "${task.title}" under item #${item_id}` +
    (task.due ? ` · due:${task.due}` : '');
}

export async function getItem(apiFn: ApiFn, { id }: { id: number }): Promise<string> {
  const item = await apiFn<ItemWithTasks>('GET', `/items/${id}`);
  const lines: string[] = [
    `# Item #${item.id}: ${item.title}`,
    `Type: ${item.type} | Status: ${item.status} | Priority: ${item.priority}`,
    `Feature: ${item.feature_name ?? '—'} | Sprint: ${item.sprint_name ?? 'none'}`,
    `Assignee: ${item.assignee_name ?? 'unassigned'}`,
    `Progress: ${item.task_done}/${item.task_total} tasks (${item.task_pct}%)`,
  ];
  if (item.description) lines.push('', `Description: ${item.description}`);
  if (item.acceptance_criteria) lines.push('', `Acceptance criteria: ${item.acceptance_criteria}`);

  const tasks = item.tasks ?? [];
  if (tasks.length) {
    lines.push('', `## Tasks (${tasks.length})`);
    tasks.forEach(t => {
      const due = t.due ? ` due:${t.due}` : '';
      const hi = t.priority === 'Cao' ? ' [HIGH]' : '';
      lines.push(`- [task:${t.id}] [${t.status ?? 'Todo'}] ${t.title}${due}${hi}`);
    });
  } else {
    lines.push('', '_No tasks yet._');
  }
  return lines.join('\n');
}

export async function listUsers(apiFn: ApiFn): Promise<string> {
  const users = await apiFn<PublicUser[]>('GET', '/users');
  if (!users.length) return '_No users found._';
  return ['# Users', ...users.map(u => `- [user:${u.id}] ${u.name} (${u.role})`)].join('\n');
}

export interface NotificationsArgs {
  unread_only?: boolean;
  limit?: number;
  mark_read?: number;
  mark_all_read?: boolean;
}

export async function notifications(apiFn: ApiFn, args: NotificationsArgs = {}): Promise<string> {
  const { unread_only, limit, mark_read, mark_all_read } = args;

  if (mark_all_read) {
    await apiFn('PATCH', '/me/notifications/read-all');
    return 'Marked all notifications as read.';
  }
  if (mark_read != null) {
    await apiFn('PATCH', `/notifications/${mark_read}/read`);
    return `Marked notification #${mark_read} as read.`;
  }

  const qs = new URLSearchParams();
  if (limit != null) qs.set('limit', String(limit));
  if (unread_only) qs.set('unread', '1');
  const query = qs.toString();
  // /me/notifications/unread-count is unusable server-side (returns an unawaited
  // promise, serializes to {}); derive the count from a dedicated unread-only fetch instead.
  const [list, unreadList] = await Promise.all([
    apiFn<Notification[]>('GET', `/me/notifications${query ? `?${query}` : ''}`),
    apiFn<Notification[]>('GET', '/me/notifications?unread=1&limit=500'),
  ]);

  const lines = [`# Notifications (${unreadList.length} unread)`];
  if (!list.length) {
    lines.push('_No notifications._');
  } else {
    list.forEach(n => {
      const ref = n.ref_type && n.ref_id ? ` [${n.ref_type}:${n.ref_id}]` : '';
      const mark = n.read_at ? '' : ' 🔵';
      lines.push(`- [notif:${n.id}]${mark} ${n.body}${ref} · ${n.created}`);
    });
  }
  return lines.join('\n');
}

function fmtHours(minutes: number): string {
  return (minutes / 60).toFixed(1).replace(/\.0$/, '');
}

function fmtLog(l: TaskLog, bullet = true): string {
  const note = l.note ? ` — ${l.note}` : '';
  const prefix = bullet ? '- ' : '';
  return `${prefix}[log:${l.id}] task:${l.task_id} ${l.date} · ${fmtHours(l.minutes)}h${note}`;
}

export interface LogTimeArgs {
  action: 'log' | 'list' | 'update' | 'delete';
  task_id?: number;
  id?: number;
  minutes?: number;
  date?: string;
  from?: string;
  to?: string;
  note?: string;
}

export async function logTime(apiFn: ApiFn, args: LogTimeArgs): Promise<string> {
  const { action, task_id, id, minutes, date, from, to, note } = args;

  if (action === 'log') {
    if (task_id == null || minutes == null) throw new Error('task_id and minutes are required to log time');
    const log = await apiFn<TaskLog>('POST', '/me/task-logs', { task_id, minutes, date, note });
    return `Logged ${fmtHours(log.minutes)}h on task #${log.task_id} (${log.date})`;
  }

  if (action === 'update') {
    if (id == null) throw new Error('id is required to update a time log');
    const log = await apiFn<TaskLog>('PATCH', `/task-logs/${id}`, { minutes, date, note });
    return `Updated ${fmtLog(log, false)}`;
  }

  if (action === 'delete') {
    if (id == null) throw new Error('id is required to delete a time log');
    await apiFn('DELETE', `/task-logs/${id}`);
    return `Deleted log #${id}`;
  }

  const qs = new URLSearchParams();
  if (from && to) { qs.set('from', from); qs.set('to', to); }
  else if (date) qs.set('date', date);
  const query = qs.toString();
  const logs = await apiFn<TaskLog[]>('GET', `/me/task-logs${query ? `?${query}` : ''}`);
  if (!logs.length) return '_No time logs found._';
  const totalMinutes = logs.reduce((s, l) => s + l.minutes, 0);
  return [`# Time Logs (${fmtHours(totalMinutes)}h total)`, ...logs.map(l => fmtLog(l))].join('\n');
}

export interface CommentArgs {
  action: 'list' | 'add' | 'update' | 'delete';
  entity_type?: 'task' | 'item' | 'feature';
  entity_id?: number;
  id?: number;
  text?: string;
}

export async function comment(apiFn: ApiFn, args: CommentArgs): Promise<string> {
  const { action, entity_type, entity_id, id, text } = args;

  if (action === 'add') {
    if (!entity_type || entity_id == null || !text) {
      throw new Error('entity_type, entity_id, and text are required to add a comment');
    }
    const att = await apiFn<Attachment>('POST', `/attachments/${entity_type}/${entity_id}`, { kind: 'comment', text });
    return `Added comment #${att.id} to ${entity_type}:${entity_id}`;
  }

  if (action === 'update') {
    if (id == null || !text) throw new Error('id and text are required to update a comment');
    const att = await apiFn<Attachment>('PATCH', `/attachments/${id}`, { text });
    return `Updated comment #${att.id}`;
  }

  if (action === 'delete') {
    if (id == null) throw new Error('id is required to delete a comment');
    await apiFn('DELETE', `/attachments/${id}`);
    return `Deleted comment #${id}`;
  }

  if (!entity_type || entity_id == null) {
    throw new Error('entity_type and entity_id are required to list comments');
  }
  const items = await apiFn<Attachment[]>('GET', `/attachments/${entity_type}/${entity_id}`);
  const cmts = items.filter(a => a.kind === 'comment');
  if (!cmts.length) return `_No comments on ${entity_type}:${entity_id}._`;
  return [
    `# Comments on ${entity_type}:${entity_id} (${cmts.length})`,
    ...cmts.map(c => `- [comment:${c.id}] user:${c.user_id ?? '?'} (${c.created ?? '—'}): ${c.text}`),
  ].join('\n');
}
