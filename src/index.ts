import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { login, api, getMe } from './api.js';
import {
  dashboard, updateWork, addTask, getItem, myItems, listUsers, listProjects,
  getProject, updateProject, projectHealth, projectEvm, listProjectMembers, listSprints,
  listMeetings, getMeeting, addMeeting, updateMeeting, addMeetingAction,
  addBlock, updateBlock, addFeature, updateFeature, addItem, addSprint, deleteBlock, deleteFeature, addPhase,
  weekGoals, weekPriorities, notifications, logTime, comment,
} from './skills.js';
import { loadConfig } from './config.js';
import { startUpdateCheck } from './update.js';
import { formatError } from './errors.js';
import type {
  UpdateWorkArgs, AddTaskArgs, MyItemsArgs, ListProjectsArgs,
  UpdateProjectArgs, AddMeetingArgs, UpdateMeetingArgs, AddMeetingActionArgs,
  AddBlockArgs, UpdateBlockArgs, AddFeatureArgs, UpdateFeatureArgs, AddItemArgs, AddSprintArgs, AddPhaseArgs,
  WeekGoalsArgs, WeekPrioritiesArgs, NotificationsArgs, LogTimeArgs, CommentArgs,
} from './skills.js';

declare const __PKG_VERSION__: string;

// Last-resort net: without this, any exception outside the try/catch blocks below
// (or thrown asynchronously once the MCP server is running) prints a raw Node
// stack trace and dies silently from Claude's perspective instead of a clean message.
process.on('uncaughtException', (err) => {
  process.stderr.write(`viot-tasktisk: ${formatError(err)}\n`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`viot-tasktisk: ${formatError(reason)}\n`);
  process.exit(1);
});

const subcommand = process.argv[2];
const subArgs = process.argv.slice(3);

// ── CLI subcommand dispatch ────────────────────────────────────────────────────
// Each handler lazily imports its module so a plain CLI invocation doesn't pull in
// the MCP server/login path. Add new subcommands as another entry here.

type CommandFn = (args: string[]) => Promise<void>;

const commands: Record<string, CommandFn> = {
  setup: async () => {
    const { runSetup } = await import('./setup.js');
    await runSetup();
  },
  configure: async () => {
    const { runConfigure } = await import('./setup.js');
    let prefix: string | undefined;
    try { prefix = loadConfig().installPrefix; } catch { /* ok */ }
    await runConfigure(prefix);
  },
  update: async () => {
    const { runUpdate } = await import('./update.js');
    await runUpdate();
  },
  whoami: async () => {
    const { runWhoami } = await import('./cli.js');
    await runWhoami();
  },
  dashboard: async () => {
    const { runDashboard } = await import('./cli.js');
    await runDashboard();
  },
  'my-tasks': async () => {
    const { runDashboard } = await import('./cli.js');
    await runDashboard();
  },
  'get-item': async (args) => {
    const { runGetItem } = await import('./cli.js');
    await runGetItem(args);
  },
  'my-items': async (args) => {
    const { runMyItems } = await import('./cli.js');
    await runMyItems(args);
  },
  'add-task': async (args) => {
    const { runAddTask } = await import('./cli.js');
    await runAddTask(args);
  },
  'update-task': async (args) => {
    const { runUpdateTask } = await import('./cli.js');
    await runUpdateTask(args);
  },
  'update-item': async (args) => {
    const { runUpdateItem } = await import('./cli.js');
    await runUpdateItem(args);
  },
  'list-users': async () => {
    const { runListUsers } = await import('./cli.js');
    await runListUsers();
  },
  'list-projects': async (args) => {
    const { runListProjects } = await import('./cli.js');
    await runListProjects(args);
  },
  'week-goals': async (args) => {
    const { runWeekGoals } = await import('./cli.js');
    await runWeekGoals(args);
  },
  'week-priorities': async (args) => {
    const { runWeekPriorities } = await import('./cli.js');
    await runWeekPriorities(args);
  },
  notifications: async (args) => {
    const { runNotifications } = await import('./cli.js');
    await runNotifications(args);
  },
  'log-time': async (args) => {
    const { runLogTime } = await import('./cli.js');
    await runLogTime(args);
  },
  comment: async (args) => {
    const { runComment } = await import('./cli.js');
    await runComment(args);
  },
  '--help': async () => { (await import('./cli.js')).printHelp(); },
  '-h': async () => { (await import('./cli.js')).printHelp(); },
  help: async () => { (await import('./cli.js')).printHelp(); },
};

if (subcommand && subcommand in commands) {
  try {
    await commands[subcommand](subArgs);
  } catch (e) {
    process.stderr.write(`viot-tasktisk: ${formatError(e)}\n`);
    process.exit(1);
  }
  process.exit(0);
}

// ── MCP server (default, no subcommand) ────────────────────────────────────────

let cfg;
try {
  cfg = loadConfig();
} catch (e) {
  process.stderr.write(`${formatError(e)}\n`);
  process.exit(1);
}

process.stderr.write(`viot-tasktisk: url=${cfg.url} user=${cfg.username} — logging in...\n`);

try {
  const me = await login(cfg.url, cfg.username, cfg.password);
  process.stderr.write(`viot-tasktisk: logged in as ${me.name} (${me.role})\n`);
  startUpdateCheck(); // fire-and-forget; notifies via stderr + dashboard banner
} catch (e) {
  process.stderr.write(`viot-tasktisk: login failed — ${formatError(e)}\n`);
  process.exit(1);
}

const server = new Server(
  { name: 'viot-tasktisk', version: __PKG_VERSION__ },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'dashboard',
      description:
        'Get your personal task dashboard: tasks grouped by urgency (overdue / due today / ' +
        "this week / later / done) plus the team's weekly priorities. " +
        'Call this first to understand what to work on.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'update_work',
      description:
        'Update the status (and optionally due date or priority) of a task or item. ' +
        'Task statuses: Plan · Todo · Doing · Done · Close · Need help. ' +
        'Item statuses: Todo · Doing · Review · Done · Cancelled.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id:       { type: 'number', description: 'ID shown in dashboard as task:N or item:N' },
          kind:     { type: 'string', enum: ['task', 'item'], description: '"task" or "item"' },
          status:   { type: 'string', description: 'New status (see valid values in description)' },
          due:      { type: 'string', description: 'Due date YYYY-MM-DD (optional)' },
          priority: { type: 'string', enum: ['Cao', 'TB', 'Thấp'], description: 'Priority (optional)' },
        },
        required: ['id', 'kind', 'status'],
      },
    },
    {
      name: 'get_item',
      description:
        'Get full detail of an Item: type, status, sprint, assignee, description, ' +
        'acceptance criteria, and all child tasks with statuses and due dates.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number', description: 'Item ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'add_task',
      description: 'Create a new task under an existing Item.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          item_id:  { type: 'number', description: 'Parent Item ID' },
          title:    { type: 'string', description: 'Task title' },
          descr:    { type: 'string', description: 'Description (optional)' },
          due:      { type: 'string', description: 'Due date YYYY-MM-DD (optional)' },
          priority: { type: 'string', enum: ['Cao', 'TB', 'Thấp'], description: 'Priority (optional)' },
          assignee: { type: 'number', description: 'User ID to assign (optional)' },
        },
        required: ['item_id', 'title'],
      },
    },
    {
      name: 'my_items',
      description:
        'List Items (not Tasks) assigned to you, with progress (tasks done/total) and status. ' +
        'An Item can be assigned to you even if none of its child Tasks are — use this to catch that.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          include_closed: { type: 'boolean', description: 'Include Done/Cancelled items (optional, default false)' },
        },
      },
    },
    {
      name: 'list_users',
      description: 'List all users (id, name, role) — use to resolve a name to a user id for assignment.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'list_projects',
      description:
        'List projects with basic info: id, name, customer, status, progress %, MD used/budget, start/end. ' +
        'Set mine_only=true to only get projects where the logged-in user is PM.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          mine_only: { type: 'boolean', description: 'Only projects where I am PM (optional)' },
          status:    { type: 'string', description: 'Filter by status: Demo · Đang chạy · Bảo trì · Tạm dừng · Đóng · Huỷ (optional)' },
        },
      },
    },
    {
      name: 'get_project',
      description:
        'Get project detail: blocks + features (with progress %), sprints, gates passed. ' +
        'Use this to understand project structure before drilling into meetings/tasks/items.',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'number', description: 'Project ID' } },
        required: ['id'],
      },
    },
    {
      name: 'update_project',
      description:
        'Update project fields: name, customer, status, MD budget, start/end dates, warranty dates, PM, vision. ' +
        'Only fields provided are patched.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id:              { type: 'number', description: 'Project ID' },
          name:            { type: 'string' },
          customer:        { type: 'string' },
          customer_id:     { type: 'number', description: 'ID from customer directory (optional)' },
          status:          { type: 'string', enum: ['Demo', 'Đang chạy', 'Bảo trì', 'Tạm dừng', 'Đóng', 'Huỷ'] },
          md_budget:       { type: 'number', description: 'ManDay budget' },
          start:           { type: 'string', description: 'Start date YYYY-MM-DD' },
          end:             { type: 'string', description: 'End date YYYY-MM-DD' },
          warranty_start:  { type: 'string', description: 'Warranty start YYYY-MM-DD' },
          warranty_end:    { type: 'string', description: 'Warranty end YYYY-MM-DD' },
          pm:              { type: 'number', description: 'User ID of PM' },
          vision:          { type: 'string' },
        },
        required: ['id'],
      },
    },
    {
      name: 'project_health',
      description:
        'Compute RAG (Red/Amber/Green) health for a project across 5 indicators: ' +
        'Tiến độ, Ngân sách, Phản hồi mở, Task quá hạn, Rủi ro. Returns overall status + score 0-100.',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'number', description: 'Project ID' } },
        required: ['id'],
      },
    },
    {
      name: 'project_evm',
      description:
        'Compute PMBOK Earned Value Management for a project: BAC · EV · AC · PV · CPI · SPI · CV · SV · EAC. ' +
        'CPI/SPI < 0.9 = red flag.',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'number', description: 'Project ID' } },
        required: ['id'],
      },
    },
    {
      name: 'list_project_members',
      description: 'List members of a project (user_id, name, project role, joined date).',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'number', description: 'Project ID' } },
        required: ['id'],
      },
    },
    {
      name: 'list_sprints',
      description: 'List sprints of a project (name, status, start/end, goal).',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'number', description: 'Project ID' } },
        required: ['id'],
      },
    },
    {
      name: 'list_meetings',
      description:
        'List meetings of a project with compact summary chips: X ý kiến · Y hành động · có tổng kết. ' +
        'Use get_meeting for full detail.',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'number', description: 'Project ID' } },
        required: ['id'],
      },
    },
    {
      name: 'get_meeting',
      description:
        'Get meeting detail: purpose, tổng kết, nội dung thảo luận, kế hoạch hành động (với người phụ trách + hạn).',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'number', description: 'Meeting ID' } },
        required: ['id'],
      },
    },
    {
      name: 'add_meeting',
      description: 'Create a new meeting in a project.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project_id: { type: 'number', description: 'Project ID' },
          title:      { type: 'string', description: 'Meeting title / chủ đề' },
          type:       { type: 'string', enum: ['Khách hàng', 'Review nội bộ'], description: 'Meeting type (default Review nội bộ)' },
          date:       { type: 'string', description: 'Date YYYY-MM-DD (default today)' },
          attendees:  { type: 'array', items: { type: 'string' }, description: 'Attendee names' },
          purpose:    { type: 'string', description: 'Mục đích cuộc họp' },
        },
        required: ['project_id', 'title'],
      },
    },
    {
      name: 'update_meeting',
      description: 'Update meeting fields: title, type, date, attendees, purpose (mục đích), summary (tổng kết).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id:        { type: 'number', description: 'Meeting ID' },
          title:     { type: 'string' },
          type:      { type: 'string', enum: ['Khách hàng', 'Review nội bộ'] },
          date:      { type: 'string', description: 'YYYY-MM-DD' },
          attendees: { type: 'array', items: { type: 'string' } },
          purpose:   { type: 'string', description: 'Mục đích cuộc họp' },
          summary:   { type: 'string', description: '📝 Tổng kết cuộc họp — ghi sau khi họp xong' },
        },
        required: ['id'],
      },
    },
    {
      name: 'add_block',
      description: 'Tạo khối (Epic) mới trong dự án. Khối chứa nhiều tính năng liên quan.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project_id: { type: 'number', description: 'Project ID' },
          name:       { type: 'string', description: 'Tên khối (VD "Quản lý người dùng")' },
          code:       { type: 'string', description: 'Mã khối (VD "M01")' },
          descr:      { type: 'string', description: 'Mô tả' },
          owner:      { type: 'number', description: 'User ID người chịu trách nhiệm' },
        },
        required: ['project_id', 'name'],
      },
    },
    {
      name: 'update_block',
      description: 'Sửa khối: tên, code, mô tả, owner.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id:    { type: 'number', description: 'Block ID' },
          name:  { type: 'string' },
          code:  { type: 'string' },
          descr: { type: 'string' },
          owner: { type: 'number', description: 'User ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'add_feature',
      description:
        'Tạo tính năng (Feature) mới trong 1 khối. Feature là đơn vị bàn giao — có 4 pha ' +
        '(Design/Build/Triển khai/Nghiệm thu), ManDay ước lượng, priority.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project_id: { type: 'number', description: 'Project ID' },
          block_id:   { type: 'number', description: 'Block ID (khối cha)' },
          name:       { type: 'string', description: 'Tên tính năng' },
          code:       { type: 'string', description: 'Mã (VD "F01")' },
          descr:      { type: 'string', description: 'Mô tả chi tiết' },
          md:         { type: 'number', description: 'ManDay ước lượng' },
          priority:   { type: 'string', enum: ['Cao', 'TB', 'Thấp'], description: 'Ưu tiên (default TB)' },
          assignee:   { type: 'number', description: 'User ID người chịu trách nhiệm chung' },
          start:      { type: 'string', description: 'Ngày bắt đầu YYYY-MM-DD' },
          end:        { type: 'string', description: 'Ngày kết thúc YYYY-MM-DD' },
        },
        required: ['project_id', 'block_id', 'name'],
      },
    },
    {
      name: 'update_feature',
      description:
        'Sửa tính năng: name, code, descr, md, priority, block_id, assignee, start, end, ' +
        '% các pha (pd/pb/pv/pf), phase_weights (CSV "20,55,12.5,12.5" — 0 = pha đó không áp dụng).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id:            { type: 'number', description: 'Feature ID' },
          name:          { type: 'string' },
          code:          { type: 'string' },
          descr:         { type: 'string' },
          md:            { type: 'number' },
          priority:      { type: 'string', enum: ['Cao', 'TB', 'Thấp'] },
          block_id:      { type: 'number' },
          assignee:      { type: 'number' },
          start:         { type: 'string', description: 'YYYY-MM-DD' },
          end:           { type: 'string', description: 'YYYY-MM-DD' },
          pd:            { type: 'number', description: '% Design (0-100)' },
          pb:            { type: 'number', description: '% Build (0-100)' },
          pv:            { type: 'number', description: '% Triển khai (0-100)' },
          pf:            { type: 'number', description: '% Nghiệm thu (0-100)' },
          phase_weights: { type: 'string', description: 'CSV weights "pd,pb,pv,pf" (VD "20,55,12.5,12.5")' },
        },
        required: ['id'],
      },
    },
    {
      name: 'add_item',
      description:
        'Tạo Item mới dưới 1 Feature. Item là đơn vị backlog theo chuẩn Scrum: ' +
        'story (yêu cầu), bug (lỗi), tech (việc kỹ thuật), spike (nghiên cứu).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          feature_id:          { type: 'number', description: 'Feature ID (cha)' },
          type:                { type: 'string', enum: ['story', 'bug', 'tech', 'spike'] },
          title:               { type: 'string', description: 'Tiêu đề ngắn gọn' },
          description:         { type: 'string', description: 'Mô tả · Persona / Mục tiêu / Lý do' },
          priority:            { type: 'string', enum: ['Cao', 'TB', 'Thấp'] },
          sprint_id:           { type: 'number', description: 'Sprint ID (nếu đã gán)' },
          story_points:        { type: 'number', description: 'Story Points' },
          assignee:            { type: 'number', description: 'User ID' },
          acceptance_criteria: { type: 'string', description: 'Tiêu chí chấp nhận' },
        },
        required: ['feature_id', 'type', 'title'],
      },
    },
    {
      name: 'add_phase',
      description:
        'Tạo giai đoạn (Phase) mới với 4 mốc kế hoạch: kickoff, build_done, deploy_done, accept_done. ' +
        'Dùng để config Timeline dự án.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project_id:       { type: 'number', description: 'Project ID' },
          name:             { type: 'string', description: 'Tên giai đoạn (VD "GĐ1 — Wave 1")' },
          code:             { type: 'string', description: 'Mã (VD "GD1")' },
          descr:            { type: 'string', description: 'Mô tả' },
          plan_kickoff:     { type: 'string', description: 'Kế hoạch — Ngày KickOff YYYY-MM-DD' },
          plan_build_done:  { type: 'string', description: 'Kế hoạch — Build xong YYYY-MM-DD' },
          plan_deploy_done: { type: 'string', description: 'Kế hoạch — Triển khai xong YYYY-MM-DD' },
          plan_accept_done: { type: 'string', description: 'Kế hoạch — Nghiệm thu xong YYYY-MM-DD' },
        },
        required: ['project_id', 'name'],
      },
    },
    {
      name: 'delete_block',
      description: 'Xoá khối. LƯU Ý: sẽ xoá luôn tất cả tính năng và item con thuộc khối.',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'number', description: 'Block ID' } },
        required: ['id'],
      },
    },
    {
      name: 'delete_feature',
      description: 'Xoá tính năng. LƯU Ý: sẽ xoá luôn tất cả item con thuộc tính năng.',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'number', description: 'Feature ID' } },
        required: ['id'],
      },
    },
    {
      name: 'add_sprint',
      description: 'Tạo sprint mới cho dự án.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project_id: { type: 'number' },
          name:       { type: 'string', description: 'Tên sprint (VD "S1 — Nền tảng")' },
          goal:       { type: 'string', description: 'Mục tiêu sprint' },
          start:      { type: 'string', description: 'YYYY-MM-DD' },
          end:        { type: 'string', description: 'YYYY-MM-DD' },
          status:     { type: 'string', description: 'Kế hoạch · Đang chạy · Đã đóng (default Kế hoạch)' },
        },
        required: ['project_id', 'name'],
      },
    },
    {
      name: 'add_meeting_action',
      description:
        'Add a discussion point or action item to a meeting. ' +
        'kind="discussion" (default) = nội dung thảo luận (text + proposer). ' +
        'kind="action" = kế hoạch hành động (text + assignee_text + due).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          meeting_id:    { type: 'number', description: 'Meeting ID' },
          text:          { type: 'string', description: 'Nội dung ý kiến / việc cần làm' },
          kind:          { type: 'string', enum: ['discussion', 'action'], description: 'Loại (default discussion)' },
          proposer:      { type: 'string', description: 'Ai đề xuất (dùng khi kind=discussion)' },
          assignee_text: { type: 'string', description: 'Người phụ trách (dùng khi kind=action, free text — có thể là đối tác)' },
          due:           { type: 'string', description: 'Hạn YYYY-MM-DD (dùng khi kind=action)' },
        },
        required: ['meeting_id', 'text'],
      },
    },
    {
      name: 'week_goals',
      description:
        'Mục tiêu tuần (màn hình "Mục tiêu tuần" / #weekgoals): xem · tạo · sửa tiến độ · xoá. ' +
        'Mỗi mục tiêu gắn với 1 dự án + 1 người + 1 tuần ISO (YYYY-Wnn) và có % hoàn thành. ' +
        'Dùng để lập kế hoạch tuần cho bản thân hoặc giao mục tiêu cho thành viên. ' +
        'action="list" (mặc định tuần hiện tại, week="all" để xem hết) · "add" (cần project_id + text) · ' +
        '"update" (cần id — thường để cập nhật pct) · "delete" (cần id).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          action:     { type: 'string', enum: ['list', 'add', 'update', 'delete'], description: 'Thao tác' },
          id:         { type: 'number', description: 'Goal ID (bắt buộc cho update/delete)' },
          project_id: { type: 'number', description: 'Project ID (bắt buộc cho add; lọc khi list)' },
          user_id:    { type: 'number', description: 'User ID được giao (mặc định là chính mình khi add) — lấy id qua list_users' },
          week:       { type: 'string', description: 'Tuần ISO "YYYY-Wnn" hoặc current · next · prev · all (all chỉ dùng cho list). Mặc định tuần hiện tại.' },
          text:       { type: 'string', description: 'Nội dung mục tiêu (bắt buộc cho add)' },
          pct:        { type: 'number', description: 'Tiến độ 0-100' },
          set_by:     { type: 'string', enum: ['self', 'PM'], description: 'Ai đặt mục tiêu — tự suy ra khi add' },
          mine_only:  { type: 'boolean', description: 'Chỉ mục tiêu của tôi (khi list)' },
        },
        required: ['action'],
      },
    },
    {
      name: 'week_priorities',
      description:
        'Ưu tiên tuần này (màn hình "Ưu tiên tuần" / #priority) — danh sách PM đăng đầu tuần để cả nhóm biết ' +
        'việc gì quan trọng nhất. Mỗi mục có rank (1 = cao nhất), ghi chú, và phạm vi: 1 dự án (project_id), ' +
        '1 lead chưa ký (lead_id), hoặc chung mọi dự án (bỏ trống cả hai). ' +
        'action="list" (mặc định tuần hiện tại) · "add" · "update" (chỉ sửa được rank/note) · "delete" (cần id). ' +
        'Khác week_goals: đây là ưu tiên cấp nhóm/dự án, còn week_goals là mục tiêu của từng người.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          action:     { type: 'string', enum: ['list', 'add', 'update', 'delete'], description: 'Thao tác' },
          id:         { type: 'number', description: 'Priority ID (bắt buộc cho update/delete)' },
          week:       { type: 'string', description: 'Tuần ISO "YYYY-Wnn" hoặc current · next · prev. Mặc định tuần hiện tại.' },
          project_id: { type: 'number', description: 'Phạm vi = dự án này (khi add). Bỏ trống cả project_id lẫn lead_id = ưu tiên chung mọi dự án.' },
          lead_id:    { type: 'number', description: 'Phạm vi = lead/cơ hội chưa ký (khi add)' },
          rank:       { type: 'number', description: 'Mức ưu tiên, 1 = cao nhất (default 1)' },
          note:       { type: 'string', description: 'Ghi chú / lý do ưu tiên' },
        },
        required: ['action'],
      },
    },
    {
      name: 'notifications',
      description:
        'List your notifications (assignments, mentions, comments, completions) with unread count, ' +
        'or mark one/all as read.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          unread_only:   { type: 'boolean', description: 'Only show unread notifications (optional)' },
          limit:         { type: 'number', description: 'Max notifications to return (optional, default 50)' },
          mark_read:     { type: 'number', description: 'Notification ID to mark as read (optional)' },
          mark_all_read: { type: 'boolean', description: 'Mark all your notifications as read (optional)' },
        },
      },
    },
    {
      name: 'log_time',
      description:
        'Log, list, update, or delete time spent on tasks (your personal timesheet). ' +
        '"log" records new time; "list" shows your logs by date or range; ' +
        '"update"/"delete" modify an existing log entry.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          action:  { type: 'string', enum: ['log', 'list', 'update', 'delete'], description: 'Operation to perform' },
          task_id: { type: 'number', description: 'Task ID (required for action="log")' },
          id:      { type: 'number', description: 'Time log ID (required for action="update"/"delete")' },
          minutes: { type: 'number', description: 'Minutes worked (required for "log", optional for "update")' },
          date:    { type: 'string', description: 'Date YYYY-MM-DD (optional, defaults to today)' },
          from:    { type: 'string', description: 'Range start YYYY-MM-DD (for action="list")' },
          to:      { type: 'string', description: 'Range end YYYY-MM-DD (for action="list")' },
          note:    { type: 'string', description: 'Optional note' },
        },
        required: ['action'],
      },
    },
    {
      name: 'comment',
      description:
        'List, add, update, or delete comments on a task, item, or feature. ' +
        'Adding a comment on a task notifies its assignee; use @Name in the text to also notify a mentioned user.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          action:      { type: 'string', enum: ['list', 'add', 'update', 'delete'], description: 'Operation to perform' },
          entity_type: { type: 'string', enum: ['task', 'item', 'feature'], description: 'Entity type (required for "list"/"add")' },
          entity_id:   { type: 'number', description: 'Entity ID (required for "list"/"add")' },
          id:          { type: 'number', description: 'Comment ID (required for "update"/"delete")' },
          text:        { type: 'string', description: 'Comment text (required for "add"/"update")' },
        },
        required: ['action'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    let text: string;
    switch (name) {
      case 'dashboard':   text = await dashboard(api, getMe()); break;
      case 'update_work': text = await updateWork(api, args as unknown as UpdateWorkArgs); break;
      case 'get_item':    text = await getItem(api, args as { id: number }); break;
      case 'my_items':    text = await myItems(api, args as unknown as MyItemsArgs); break;
      case 'add_task':    text = await addTask(api, args as unknown as AddTaskArgs); break;
      case 'list_users':  text = await listUsers(api); break;
      case 'list_projects': text = await listProjects(api, getMe(), args as unknown as ListProjectsArgs); break;
      case 'get_project': text = await getProject(api, args as { id: number }); break;
      case 'update_project': text = await updateProject(api, args as unknown as UpdateProjectArgs); break;
      case 'project_health': text = await projectHealth(api, args as { id: number }); break;
      case 'project_evm': text = await projectEvm(api, args as { id: number }); break;
      case 'list_project_members': text = await listProjectMembers(api, args as { id: number }); break;
      case 'list_sprints': text = await listSprints(api, args as { id: number }); break;
      case 'list_meetings': text = await listMeetings(api, args as { id: number }); break;
      case 'get_meeting': text = await getMeeting(api, args as { id: number }); break;
      case 'add_meeting': text = await addMeeting(api, args as unknown as AddMeetingArgs); break;
      case 'update_meeting': text = await updateMeeting(api, args as unknown as UpdateMeetingArgs); break;
      case 'add_meeting_action': text = await addMeetingAction(api, args as unknown as AddMeetingActionArgs); break;
      case 'add_block': text = await addBlock(api, args as unknown as AddBlockArgs); break;
      case 'update_block': text = await updateBlock(api, args as unknown as UpdateBlockArgs); break;
      case 'add_feature': text = await addFeature(api, args as unknown as AddFeatureArgs); break;
      case 'update_feature': text = await updateFeature(api, args as unknown as UpdateFeatureArgs); break;
      case 'add_item': text = await addItem(api, args as unknown as AddItemArgs); break;
      case 'add_sprint': text = await addSprint(api, args as unknown as AddSprintArgs); break;
      case 'delete_block': text = await deleteBlock(api, args as { id: number }); break;
      case 'delete_feature': text = await deleteFeature(api, args as { id: number }); break;
      case 'add_phase': text = await addPhase(api, args as unknown as AddPhaseArgs); break;
      case 'week_goals': text = await weekGoals(api, getMe(), args as unknown as WeekGoalsArgs); break;
      case 'week_priorities': text = await weekPriorities(api, args as unknown as WeekPrioritiesArgs); break;
      case 'notifications': text = await notifications(api, args as unknown as NotificationsArgs); break;
      case 'log_time':    text = await logTime(api, args as unknown as LogTimeArgs); break;
      case 'comment':     text = await comment(api, args as unknown as CommentArgs); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text' as const, text }] };
  } catch (e) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
