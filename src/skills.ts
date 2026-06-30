import type { User } from './api.js';

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

  const lines: string[] = [`# Dashboard — ${me?.name ?? 'Me'} · ${tod} (${prio.week})\n`];

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
