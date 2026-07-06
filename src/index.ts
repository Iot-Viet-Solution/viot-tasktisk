import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { login, api, getMe } from './api.js';
import { dashboard, updateWork, addTask, getItem, listUsers, notifications, logTime, comment } from './skills.js';
import { loadConfig } from './config.js';
import { startUpdateCheck } from './update.js';
import type { UpdateWorkArgs, AddTaskArgs, NotificationsArgs, LogTimeArgs, CommentArgs } from './skills.js';

const subcommand = process.argv[2];
const subArgs = process.argv.slice(3);

// ── Setup / maintenance subcommands ──────────────────────────────────────────

if (subcommand === 'setup') {
  const { runSetup } = await import('./setup.js');
  await runSetup();
  process.exit(0);
}

if (subcommand === 'configure') {
  const { runConfigure } = await import('./setup.js');
  let prefix: string | undefined;
  try { prefix = loadConfig().installPrefix; } catch { /* ok */ }
  await runConfigure(prefix);
  process.exit(0);
}

if (subcommand === 'update') {
  const { runUpdate } = await import('./update.js');
  await runUpdate();
  process.exit(0);
}

// ── Direct CLI commands ───────────────────────────────────────────────────────

if (subcommand === 'dashboard' || subcommand === 'my-tasks') {
  const { runDashboard } = await import('./cli.js');
  await runDashboard();
  process.exit(0);
}

if (subcommand === 'get-item') {
  const { runGetItem } = await import('./cli.js');
  await runGetItem(subArgs);
  process.exit(0);
}

if (subcommand === 'add-task') {
  const { runAddTask } = await import('./cli.js');
  await runAddTask(subArgs);
  process.exit(0);
}

if (subcommand === 'update-task') {
  const { runUpdateTask } = await import('./cli.js');
  await runUpdateTask(subArgs);
  process.exit(0);
}

if (subcommand === 'update-item') {
  const { runUpdateItem } = await import('./cli.js');
  await runUpdateItem(subArgs);
  process.exit(0);
}

if (subcommand === 'list-users') {
  const { runListUsers } = await import('./cli.js');
  await runListUsers();
  process.exit(0);
}

if (subcommand === 'notifications') {
  const { runNotifications } = await import('./cli.js');
  await runNotifications(subArgs);
  process.exit(0);
}

if (subcommand === 'log-time') {
  const { runLogTime } = await import('./cli.js');
  await runLogTime(subArgs);
  process.exit(0);
}

if (subcommand === 'comment') {
  const { runComment } = await import('./cli.js');
  await runComment(subArgs);
  process.exit(0);
}

if (subcommand === '--help' || subcommand === '-h' || subcommand === 'help') {
  const { printHelp } = await import('./cli.js');
  printHelp();
  process.exit(0);
}

let cfg;
try {
  cfg = loadConfig();
} catch (e) {
  process.stderr.write(`${(e as Error).message}\n`);
  process.exit(1);
}

try {
  const me = await login(cfg.url, cfg.username, cfg.password);
  process.stderr.write(`viot-tasktisk: logged in as ${me.name} (${me.role})\n`);
  startUpdateCheck(); // fire-and-forget; notifies via stderr + dashboard banner
} catch (e) {
  process.stderr.write(`Login failed: ${(e as Error).message}\n`);
  process.exit(1);
}

const server = new Server(
  { name: 'viot-tasktisk', version: '1.0.0' },
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
      name: 'list_users',
      description: 'List all users (id, name, role) — use to resolve a name to a user id for assignment.',
      inputSchema: { type: 'object' as const, properties: {} },
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
      case 'add_task':    text = await addTask(api, args as unknown as AddTaskArgs); break;
      case 'list_users':  text = await listUsers(api); break;
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
