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

function fmtItem(i: ItemWithTasks): string {
  const parts: string[] = [`[item:${i.id}] ${i.title}`, `(${i.status})`];
  if (i.feature_name) parts.push(`· feat:${i.feature_name}`);
  if (i.sprint_name) parts.push(`sprint:${i.sprint_name}`);
  parts.push(`${i.task_done}/${i.task_total} tasks (${i.task_pct}%)`);
  if (i.priority === 'Cao') parts.push('[HIGH]');
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

export interface MyItemsArgs {
  include_closed?: boolean;
}

export async function myItems(apiFn: ApiFn, args: MyItemsArgs = {}): Promise<string> {
  const qs = args.include_closed ? '?closed=1' : '';
  const items = await apiFn<ItemWithTasks[]>('GET', `/myitems${qs}`);
  if (!items.length) return '_No items assigned to you._';
  return [`# My Items (${items.length})`, ...items.map(fmtItem)].join('\n');
}

export async function listUsers(apiFn: ApiFn): Promise<string> {
  const users = await apiFn<PublicUser[]>('GET', '/users');
  if (!users.length) return '_No users found._';
  return ['# Users', ...users.map(u => `- [user:${u.id}] ${u.name} (${u.role})`)].join('\n');
}

interface Project {
  id: number;
  name: string;
  customer: string | null;
  pm: number | null;
  status: string;
  progress?: number;
  md_budget?: number;
  md_used?: number;
  start?: string | null;
  end?: string | null;
}

export interface ListProjectsArgs {
  /** Chỉ lấy dự án mà mình là PM (Project Manager). Mặc định false = toàn bộ */
  mine_only?: boolean;
  /** Lọc theo trạng thái: Demo · Đang chạy · Bảo trì · Tạm dừng · Đóng · Huỷ */
  status?: string;
}

export async function listProjects(
  apiFn: ApiFn,
  me: User | null,
  args: ListProjectsArgs = {}
): Promise<string> {
  const { mine_only, status } = args;
  let projs = await apiFn<Project[]>('GET', '/projects');
  if (mine_only && me) projs = projs.filter(p => p.pm === me.id);
  if (status) projs = projs.filter(p => p.status === status);
  if (!projs.length) {
    return mine_only ? '_Bạn không phải PM của dự án nào._' : '_No projects found._';
  }
  const title = mine_only
    ? `# Dự án của tôi (${projs.length})`
    : `# Projects (${projs.length})`;
  const lines: string[] = [title, ''];
  projs.forEach(p => {
    lines.push(`- **[project:${p.id}]** ${p.name}`);
    const meta1 = [
      p.customer ? `KH: ${p.customer}` : null,
      `Status: ${p.status}`,
      `Tiến độ: ${p.progress ?? 0}%`,
    ].filter(Boolean).join(' · ');
    lines.push(`  ${meta1}`);
    const meta2 = [
      `MD: ${p.md_used ?? 0}/${p.md_budget ?? 0}`,
      `${p.start || '—'} → ${p.end || '—'}`,
    ].join(' · ');
    lines.push(`  ${meta2}`);
  });
  return lines.join('\n');
}

/* ================================================================
 * PROJECT — get detail, update, health, EVM, members, sprints
 * ================================================================ */

interface Block {
  id: number; code: string | null; name: string;
  features?: Array<{
    id: number; code: string | null; name: string;
    pd: number; pb: number; pv: number; pf: number;
    md: number; priority: string; pct?: number;
    start: string | null; end: string | null;
  }>;
}
interface Sprint {
  id: number; name: string; goal: string | null;
  status: string | null; start: string | null; end: string | null;
}
interface Feedback { id: number; type: string | null; status: string | null; item?: string; }
interface Risk { id: number; title: string; category: string | null; probability: number; impact: number; status: string; }
interface MeetingSummary {
  id: number; title: string; type: string | null; date: string | null;
  attendees?: string[]; purpose?: string | null; summary?: string | null;
  actions?: Array<{ id: number; text: string; kind?: string; proposer?: string | null; assignee_text?: string | null; due?: string | null; assignee?: number | null }>;
}
interface ProjectDetail {
  id: number; name: string; customer: string | null; customer_id: number | null;
  status: string; stage: number; manual_stage?: string | null;
  start: string | null; end: string | null;
  warranty_start?: string | null; warranty_end?: string | null;
  md_budget: number; md_used: number; pm: number | null;
  vision?: string | null; progress?: number;
  blocks?: Block[]; sprints?: Sprint[];
  meetings?: MeetingSummary[]; feedback?: Feedback[];
  tasks?: TaskWithMeta[]; risks?: Risk[];
  documents?: Array<{ id: number; name: string; type: string; }>;
  gates?: Array<{ code: string; passed: 0 | 1; }>;
}

export async function getProject(apiFn: ApiFn, { id }: { id: number }): Promise<string> {
  const p = await apiFn<ProjectDetail>('GET', `/projects/${id}`);
  const blocks = p.blocks || [];
  const featCount = blocks.reduce((n, b) => n + (b.features?.length || 0), 0);
  const lines: string[] = [];
  lines.push(`# Dự án #${p.id}: ${p.name}`);
  lines.push(`KH: ${p.customer || '—'} · Status: ${p.status} · Tiến độ: ${p.progress ?? 0}%`);
  lines.push(`MD: ${p.md_used}/${p.md_budget} · Start → End: ${p.start || '—'} → ${p.end || '—'}`);
  if (p.warranty_start || p.warranty_end) {
    lines.push(`Bảo hành: ${p.warranty_start || '—'} → ${p.warranty_end || '—'}`);
  }
  if (p.vision) lines.push(`\n**Vision**: ${p.vision}`);
  lines.push(`\n## Cấu trúc: ${blocks.length} khối · ${featCount} tính năng · ${(p.sprints || []).length} sprint · ${(p.meetings || []).length} cuộc họp`);
  if (blocks.length) {
    lines.push('\n### Khối & Tính năng');
    blocks.forEach(b => {
      lines.push(`- [block:${b.id}] **${b.code || ''}** ${b.name} (${b.features?.length || 0} tính năng)`);
      (b.features || []).slice(0, 8).forEach(f => {
        lines.push(`   · [feature:${f.id}] ${f.code || ''} ${f.name} — ${f.pct ?? 0}% · ${f.md} MD · ${f.priority}`);
      });
      if ((b.features?.length || 0) > 8) lines.push(`   … và ${(b.features!.length - 8)} tính năng nữa`);
    });
  }
  const sp = p.sprints || [];
  if (sp.length) {
    lines.push(`\n### Sprint (${sp.length})`);
    sp.forEach(s => lines.push(`- [sprint:${s.id}] ${s.name} · ${s.status || 'Kế hoạch'} · ${s.start || '—'} → ${s.end || '—'}`));
  }
  const gates = (p.gates || []).filter(g => g.passed);
  if (gates.length) lines.push(`\n**Gate đã qua**: ${gates.map(g => g.code).join(' · ')}`);
  return lines.join('\n');
}

export interface UpdateProjectArgs {
  id: number;
  name?: string;
  customer?: string;
  customer_id?: number;
  status?: string;
  md_budget?: number;
  start?: string;
  end?: string;
  warranty_start?: string;
  warranty_end?: string;
  pm?: number;
  vision?: string;
}

export async function updateProject(apiFn: ApiFn, args: UpdateProjectArgs): Promise<string> {
  const { id, ...rest } = args;
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(rest) as (keyof typeof rest)[]) {
    if (rest[k] !== undefined) patch[k] = rest[k];
  }
  if (!Object.keys(patch).length) return 'Không có gì để cập nhật.';
  await apiFn('PATCH', `/projects/${id}`, patch);
  const fields = Object.keys(patch).join(', ');
  return `Đã cập nhật dự án #${id}: ${fields}`;
}

/* ---- Health & EVM: tính client-side từ project detail ---- */

function computeHealth(p: ProjectDetail): { overall: 'ok' | 'warn' | 'bad'; score: number; indicators: Array<{ label: string; val: string; sub: string; state: string; note: string }> } {
  const inds: Array<{ label: string; val: string; sub: string; state: string; note: string }> = [];
  const mdPct = p.md_budget ? Math.round((p.md_used || 0) / p.md_budget * 100) : 0;
  const actPct = p.progress || 0;
  const dlt = actPct - mdPct;
  const perfState = dlt >= -5 ? 'ok' : (dlt >= -15 ? 'warn' : 'bad');
  inds.push({ label: 'Tiến độ', val: actPct + '%', sub: 'vs ' + mdPct + '% MD', state: perfState, note: dlt >= 0 ? 'Đang vượt kế hoạch' : dlt >= -15 ? 'Chậm nhẹ' : 'Chậm đáng kể' });
  const bdgState = mdPct <= 85 ? 'ok' : (mdPct <= 100 ? 'warn' : 'bad');
  inds.push({ label: 'Ngân sách', val: mdPct + '%', sub: (p.md_used || 0) + '/' + p.md_budget + ' MD', state: bdgState, note: mdPct <= 85 ? 'Còn dư địa' : mdPct <= 100 ? 'Cận trần' : 'Vượt ngân sách' });
  const fb = p.feedback || [];
  const openFb = fb.filter(f => f.status !== 'Đã xử lý' && f.status !== 'Đã đóng').length;
  const critFb = fb.filter(f => f.type === 'Lỗi' && f.status !== 'Đã xử lý' && f.status !== 'Đã đóng').length;
  const fbState = critFb >= 3 ? 'bad' : (critFb >= 1 || openFb >= 5 ? 'warn' : 'ok');
  inds.push({ label: 'Phản hồi mở', val: String(openFb), sub: critFb + ' Lỗi nghiêm trọng', state: fbState, note: critFb >= 3 ? 'Nhiều lỗi cần xử lý' : critFb >= 1 ? 'Có lỗi ưu tiên' : 'Trong tầm kiểm soát' });
  const tasks = p.tasks || [];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter(t => t.due && t.due < today && t.status !== 'Done' && t.status !== 'Close').length;
  const needHelp = tasks.filter(t => t.status === 'Need help').length;
  const tkState = (overdue >= 5 || needHelp >= 3) ? 'bad' : (overdue >= 1 || needHelp >= 1) ? 'warn' : 'ok';
  inds.push({ label: 'Task', val: overdue + ' quá hạn', sub: needHelp + ' cần hỗ trợ', state: tkState, note: overdue === 0 && needHelp === 0 ? 'Đúng tiến độ' : 'Cần chú ý' });
  const risks = p.risks || [];
  const high = risks.filter(r => r.status !== 'Đã đóng' && (r.probability || 0) * (r.impact || 0) >= 16).length;
  const med = risks.filter(r => r.status !== 'Đã đóng' && (r.probability || 0) * (r.impact || 0) >= 9 && (r.probability || 0) * (r.impact || 0) < 16).length;
  const rkState = high >= 2 ? 'bad' : (high >= 1 || med >= 3) ? 'warn' : 'ok';
  inds.push({ label: 'Rủi ro', val: high + ' Cao', sub: med + ' TB', state: rkState, note: high >= 2 ? 'Cần can thiệp ngay' : 'Trong tầm kiểm soát' });
  const bads = inds.filter(x => x.state === 'bad').length;
  const warns = inds.filter(x => x.state === 'warn').length;
  const overall: 'ok' | 'warn' | 'bad' = bads >= 2 ? 'bad' : (bads >= 1 || warns >= 2) ? 'warn' : 'ok';
  const score = Math.round(inds.filter(x => x.state === 'ok').length / inds.length * 100);
  return { overall, score, indicators: inds };
}

export async function projectHealth(apiFn: ApiFn, { id }: { id: number }): Promise<string> {
  const p = await apiFn<ProjectDetail>('GET', `/projects/${id}`);
  const H = computeHealth(p);
  const icons = { ok: '🟢', warn: '🟡', bad: '🔴' };
  const label = { ok: 'Khoẻ mạnh', warn: 'Cần chú ý', bad: 'Rủi ro cao' };
  const lines: string[] = [];
  lines.push(`# Sức khoẻ dự án — ${p.name}`);
  lines.push(`${icons[H.overall]} **${label[H.overall]}** · Điểm: **${H.score}/100**\n`);
  lines.push('## Chỉ số chi tiết');
  H.indicators.forEach(x => {
    lines.push(`- ${icons[x.state as 'ok' | 'warn' | 'bad']} **${x.label}**: ${x.val} · ${x.sub} — ${x.note}`);
  });
  return lines.join('\n');
}

export async function projectEvm(apiFn: ApiFn, { id }: { id: number }): Promise<string> {
  const p = await apiFn<ProjectDetail>('GET', `/projects/${id}`);
  const BAC = p.md_budget || 0;
  const EV = BAC * (p.progress || 0) / 100;
  const AC = p.md_used || 0;
  const startD = p.start ? new Date(p.start) : null;
  const endD = p.end ? new Date(p.end) : null;
  let pctTime = 0;
  if (startD && endD && endD > startD) {
    pctTime = Math.max(0, Math.min(100, (Date.now() - +startD) / (+endD - +startD) * 100));
  }
  const PV = BAC * pctTime / 100;
  const CV = EV - AC, SV = EV - PV;
  const CPI = AC > 0 ? EV / AC : null;
  const SPI = PV > 0 ? EV / PV : null;
  const EAC = CPI ? BAC / CPI : null;
  const r = (n: number, d = 1) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
  const lines: string[] = [];
  lines.push(`# EVM (Earned Value Management) — ${p.name}\n`);
  lines.push(`**BAC** (ngân sách tổng): ${BAC} MD`);
  lines.push(`**EV**  (giá trị đã đạt): ${r(EV)} MD  = BAC × ${p.progress ?? 0}%`);
  lines.push(`**AC**  (MD đã dùng): ${r(AC)} MD`);
  lines.push(`**PV**  (kế hoạch theo lịch): ${r(PV)} MD  (${r(pctTime, 0)}% thời gian trôi)`);
  lines.push('');
  lines.push(`**CPI** (Cost Performance): ${CPI ? r(CPI, 2) : '—'} ${CPI && CPI < 0.9 ? '⚠ vượt ngân sách' : ''}`);
  lines.push(`**SPI** (Schedule Performance): ${SPI ? r(SPI, 2) : '—'} ${SPI && SPI < 0.9 ? '⚠ chậm tiến độ' : ''}`);
  lines.push(`**CV** = EV - AC = ${CV >= 0 ? '+' : ''}${r(CV)} MD`);
  lines.push(`**SV** = EV - PV = ${SV >= 0 ? '+' : ''}${r(SV)} MD`);
  lines.push(`**EAC** (dự báo tổng MD): ${EAC ? r(EAC) : '—'} MD`);
  return lines.join('\n');
}

interface Member { id: number; user_id: number; user_name?: string; proj_role: string; added_at: string | null; }

export async function listProjectMembers(apiFn: ApiFn, { id }: { id: number }): Promise<string> {
  const members = await apiFn<Member[]>('GET', `/projects/${id}/members`);
  if (!members.length) return `_Dự án #${id} chưa có thành viên._`;
  const lines: string[] = [`# Thành viên dự án #${id} (${members.length})`, ''];
  members.forEach(m => {
    lines.push(`- [user:${m.user_id}] ${m.user_name || 'user #' + m.user_id} · **${m.proj_role}** · joined ${m.added_at || '—'}`);
  });
  return lines.join('\n');
}

export async function listSprints(apiFn: ApiFn, { id }: { id: number }): Promise<string> {
  const p = await apiFn<ProjectDetail>('GET', `/projects/${id}`);
  const sp = p.sprints || [];
  if (!sp.length) return `_Dự án #${id} chưa có sprint._`;
  const lines: string[] = [`# Sprint dự án #${id} (${sp.length})`, ''];
  sp.forEach(s => {
    lines.push(`- [sprint:${s.id}] **${s.name}** · ${s.status || 'Kế hoạch'} · ${s.start || '—'} → ${s.end || '—'}`);
    if (s.goal) lines.push(`   Mục tiêu: ${s.goal}`);
  });
  return lines.join('\n');
}

/* ================================================================
 * MEETINGS — list, get, add, update, add_action
 * ================================================================ */

export async function listMeetings(apiFn: ApiFn, { id }: { id: number }): Promise<string> {
  const meetings = await apiFn<MeetingSummary[]>('GET', `/projects/${id}/meetings`);
  if (!meetings.length) return `_Dự án #${id} chưa có cuộc họp._`;
  const lines: string[] = [`# Cuộc họp dự án #${id} (${meetings.length})`, ''];
  meetings.forEach(m => {
    const acts = m.actions || [];
    const disCount = acts.filter(a => (a.kind || 'discussion') === 'discussion' && (a.text || '').trim()).length;
    const actCount = acts.filter(a => a.kind === 'action' && (a.text || '').trim()).length;
    const hasSummary = !!(m.summary && m.summary.trim());
    const chips = [
      disCount ? `💬 ${disCount} ý kiến` : '',
      actCount ? `📋 ${actCount} hành động` : '',
      hasSummary ? '📝 có tổng kết' : '',
    ].filter(Boolean).join(' · ');
    lines.push(`- [meeting:${m.id}] **${m.title}** · ${m.type || '—'} · 📅 ${m.date || '—'}${chips ? ' · ' + chips : ''}`);
  });
  return lines.join('\n');
}

export async function getMeeting(apiFn: ApiFn, { id }: { id: number }): Promise<string> {
  // Không có endpoint GET /meetings/:id → fetch qua project detail rồi filter.
  // Cần biết project_id — gọi 1 lần /meetings/:id/tasks không có; workaround: dùng
  // /projects danh sách rồi từng project lấy meetings. Optimize: gọi thẳng
  // /projects/:pid nếu client biết. Nếu không, dùng approach naïve.
  const projs = await apiFn<Array<{ id: number }>>('GET', '/projects');
  for (const p of projs) {
    const meetings = await apiFn<MeetingSummary[]>('GET', `/projects/${p.id}/meetings`);
    const m = meetings.find(x => x.id === id);
    if (m) return formatMeetingDetail(m);
  }
  return `_Không tìm thấy cuộc họp #${id}._`;
}

function formatMeetingDetail(m: MeetingSummary): string {
  const lines: string[] = [];
  lines.push(`# Cuộc họp #${m.id}: ${m.title}`);
  lines.push(`Loại: ${m.type || '—'} · Ngày: ${m.date || '—'}`);
  lines.push(`Tham dự: ${(m.attendees || []).join(', ') || '—'}`);
  if (m.purpose) lines.push(`\n**🎯 Mục đích**\n${m.purpose}`);
  if (m.summary) lines.push(`\n**📝 Tổng kết**\n${m.summary}`);
  const acts = m.actions || [];
  const discussions = acts.filter(a => (a.kind || 'discussion') === 'discussion');
  const actions = acts.filter(a => a.kind === 'action');
  if (discussions.length) {
    lines.push(`\n## 💬 Nội dung thảo luận (${discussions.length})`);
    discussions.forEach((a, i) => lines.push(`${i + 1}. ${a.text} — _${a.proposer || 'ẩn danh'}_`));
  }
  if (actions.length) {
    lines.push(`\n## 📋 Kế hoạch hành động (${actions.length})`);
    actions.forEach((a, i) => {
      const who = a.assignee_text || (a.assignee ? 'user #' + a.assignee : 'chưa giao');
      lines.push(`${i + 1}. ${a.text} — 👤 ${who} · ⏰ ${a.due || 'chưa đặt hạn'}`);
    });
  }
  return lines.join('\n');
}

export interface AddMeetingArgs {
  project_id: number;
  title: string;
  type?: 'Khách hàng' | 'Review nội bộ';
  date?: string;
  attendees?: string[];
  purpose?: string;
}

export async function addMeeting(apiFn: ApiFn, args: AddMeetingArgs): Promise<string> {
  const { project_id, ...rest } = args;
  const body = {
    title: rest.title,
    type: rest.type || 'Review nội bộ',
    date: rest.date || new Date().toISOString().slice(0, 10),
    attendees: rest.attendees || [],
    purpose: rest.purpose || '',
  };
  const m = await apiFn<MeetingSummary>('POST', `/projects/${project_id}/meetings`, body);
  return `Đã tạo cuộc họp [meeting:${m.id}] "${m.title}" ngày ${m.date}. Nhập ý kiến/tổng kết bằng update_meeting hoặc add_meeting_action.`;
}

export interface UpdateMeetingArgs {
  id: number;
  title?: string;
  type?: 'Khách hàng' | 'Review nội bộ';
  date?: string;
  attendees?: string[];
  purpose?: string;
  summary?: string;
}

export async function updateMeeting(apiFn: ApiFn, args: UpdateMeetingArgs): Promise<string> {
  const { id, ...rest } = args;
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(rest) as (keyof typeof rest)[]) {
    if (rest[k] !== undefined) patch[k] = rest[k];
  }
  if (!Object.keys(patch).length) return 'Không có gì để cập nhật.';
  await apiFn('PATCH', `/meetings/${id}`, patch);
  return `Đã cập nhật cuộc họp #${id}: ${Object.keys(patch).join(', ')}`;
}

export interface AddMeetingActionArgs {
  meeting_id: number;
  text: string;
  kind?: 'discussion' | 'action';
  proposer?: string;
  assignee_text?: string;
  due?: string;
}

export async function addMeetingAction(apiFn: ApiFn, args: AddMeetingActionArgs): Promise<string> {
  const { meeting_id, ...rest } = args;
  const kind = rest.kind || 'discussion';
  const body = {
    text: rest.text,
    kind,
    proposer: rest.proposer || null,
    assignee_text: rest.assignee_text || null,
    due: rest.due || null,
  };
  const a = await apiFn<{ id: number }>('POST', `/meetings/${meeting_id}/actions`, body);
  return `Đã thêm ${kind === 'action' ? 'hành động' : 'ý kiến'} #${a.id} vào cuộc họp #${meeting_id}.`;
}

/* ================================================================
 * BLOCK / FEATURE / ITEM / SPRINT — CRUD để dựng cấu trúc dự án
 * ================================================================ */

export interface AddBlockArgs {
  project_id: number;
  name: string;
  code?: string;
  descr?: string;
  owner?: number;
}

export async function addBlock(apiFn: ApiFn, args: AddBlockArgs): Promise<string> {
  const { project_id, name, code, descr, owner } = args;
  const body = { name, code: code || '', descr: descr || '', owner: owner ?? null };
  const b = await apiFn<{ id: number; name: string; code: string | null }>(
    'POST', `/projects/${project_id}/blocks`, body
  );
  return `Đã tạo khối [block:${b.id}] ${b.code || ''} — ${b.name} trong dự án #${project_id}.`;
}

export interface UpdateBlockArgs {
  id: number;
  name?: string;
  code?: string;
  descr?: string;
  owner?: number;
}

export async function updateBlock(apiFn: ApiFn, args: UpdateBlockArgs): Promise<string> {
  const { id, ...rest } = args;
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(rest) as (keyof typeof rest)[]) {
    if (rest[k] !== undefined) patch[k] = rest[k];
  }
  if (!Object.keys(patch).length) return 'Không có gì để cập nhật.';
  await apiFn('PATCH', `/blocks/${id}`, patch);
  return `Đã cập nhật khối #${id}: ${Object.keys(patch).join(', ')}`;
}

export interface AddFeatureArgs {
  project_id: number;
  block_id: number;
  name: string;
  code?: string;
  descr?: string;
  md?: number;
  priority?: 'Cao' | 'TB' | 'Thấp';
  assignee?: number;
  start?: string;
  end?: string;
}

export async function addFeature(apiFn: ApiFn, args: AddFeatureArgs): Promise<string> {
  const { project_id, block_id, name, code, descr, md, priority, assignee, start, end } = args;
  const body = {
    block_id,
    name,
    code: code || '',
    descr: descr || '',
    md: md ?? 1,
    priority: priority || 'TB',
    assignee: assignee ?? null,
    start: start || null,
    end: end || null,
  };
  const f = await apiFn<{ id: number; name: string; code: string | null }>(
    'POST', `/projects/${project_id}/features`, body
  );
  return `Đã tạo tính năng [feature:${f.id}] ${f.code || ''} ${f.name} trong khối #${block_id}.`;
}

export interface UpdateFeatureArgs {
  id: number;
  name?: string;
  code?: string;
  descr?: string;
  md?: number;
  priority?: 'Cao' | 'TB' | 'Thấp';
  block_id?: number;
  assignee?: number;
  start?: string;
  end?: string;
  pd?: number;
  pb?: number;
  pv?: number;
  pf?: number;
  phase_weights?: string;
}

export async function updateFeature(apiFn: ApiFn, args: UpdateFeatureArgs): Promise<string> {
  const { id, ...rest } = args;
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(rest) as (keyof typeof rest)[]) {
    if (rest[k] !== undefined) patch[k] = rest[k];
  }
  if (!Object.keys(patch).length) return 'Không có gì để cập nhật.';
  await apiFn('PATCH', `/features/${id}`, patch);
  return `Đã cập nhật tính năng #${id}: ${Object.keys(patch).join(', ')}`;
}

export interface AddItemArgs {
  feature_id: number;
  type: 'story' | 'bug' | 'tech' | 'spike';
  title: string;
  description?: string;
  priority?: 'Cao' | 'TB' | 'Thấp';
  sprint_id?: number;
  story_points?: number;
  assignee?: number;
  acceptance_criteria?: string;
}

export async function addItem(apiFn: ApiFn, args: AddItemArgs): Promise<string> {
  const body: Record<string, unknown> = {
    feature_id: args.feature_id,
    type: args.type,
    title: args.title,
    description: args.description || '',
    priority: args.priority || 'TB',
    status: 'Todo',
  };
  if (args.sprint_id !== undefined) body.sprint_id = args.sprint_id;
  if (args.story_points !== undefined) body.story_points = args.story_points;
  if (args.assignee !== undefined) body.assignee = args.assignee;
  if (args.acceptance_criteria) body.acceptance_criteria = args.acceptance_criteria;
  const it = await apiFn<{ id: number; title: string }>('POST', '/items', body);
  return `Đã tạo item [item:${it.id}] ${args.type}: ${it.title}`;
}

export interface AddSprintArgs {
  project_id: number;
  name: string;
  goal?: string;
  start?: string;
  end?: string;
  status?: string;
}

export async function addSprint(apiFn: ApiFn, args: AddSprintArgs): Promise<string> {
  const { project_id, ...rest } = args;
  const body = {
    name: rest.name,
    goal: rest.goal || '',
    start: rest.start || null,
    end: rest.end || null,
    status: rest.status || 'Kế hoạch',
  };
  const s = await apiFn<{ id: number; name: string }>('POST', `/projects/${project_id}/sprints`, body);
  return `Đã tạo sprint [sprint:${s.id}] ${s.name} trong dự án #${project_id}.`;
}

export async function deleteBlock(apiFn: ApiFn, { id }: { id: number }): Promise<string> {
  await apiFn('DELETE', `/blocks/${id}`);
  return `Đã xoá khối #${id} (kèm tính năng và item con).`;
}

export async function deleteFeature(apiFn: ApiFn, { id }: { id: number }): Promise<string> {
  await apiFn('DELETE', `/features/${id}`);
  return `Đã xoá tính năng #${id} (kèm item con).`;
}

export interface AddPhaseArgs {
  project_id: number;
  name: string;
  code?: string;
  descr?: string;
  plan_kickoff?: string;
  plan_build_done?: string;
  plan_deploy_done?: string;
  plan_accept_done?: string;
}

export async function addPhase(apiFn: ApiFn, args: AddPhaseArgs): Promise<string> {
  const { project_id, ...rest } = args;
  const body: Record<string, unknown> = {
    name: rest.name,
    code: rest.code || '',
    descr: rest.descr || '',
    plan_kickoff: rest.plan_kickoff || null,
    plan_build_done: rest.plan_build_done || null,
    plan_deploy_done: rest.plan_deploy_done || null,
    plan_accept_done: rest.plan_accept_done || null,
  };
  const p = await apiFn<{ id: number; name: string }>('POST', `/projects/${project_id}/phases`, body);
  return `Đã tạo giai đoạn [phase:${p.id}] ${p.name} trong dự án #${project_id}.`;
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
