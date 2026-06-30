#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { login, api, getMe } from './api.js';
import { dashboard, updateWork, addTask, getItem } from './skills.js';
import { loadConfig } from './config.js';
import { startUpdateCheck } from './update.js';
import type { UpdateWorkArgs, AddTaskArgs } from './skills.js';

const subcommand = process.argv[2];

if (subcommand === 'setup') {
  const { runSetup } = await import('./setup.js');
  await runSetup();
  process.exit(0);
}

if (subcommand === 'configure') {
  // Re-run only the Claude integration step (skip credential prompts)
  const { runConfigure } = await import('./setup.js');
  const { loadConfig } = await import('./config.js');
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
