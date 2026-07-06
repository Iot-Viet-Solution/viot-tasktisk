/**
 * Direct CLI commands — no MCP client needed.
 * These run as a one-shot process: login → call skill → print → exit.
 */

import { login, api } from './api.js';
import { dashboard, updateWork, addTask, getItem, listUsers, notifications, logTime, comment } from './skills.js';
import type { CommentArgs } from './skills.js';
import { loadConfig } from './config.js';

function die(msg: string, code = 1): never {
  process.stderr.write(msg + '\n');
  process.exit(code);
}

/** Minimal flag parser: --key value or --key=value → Record<string, string> */
function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        flags[arg.slice(2)] = argv[++i];
      } else {
        flags[arg.slice(2)] = 'true';
      }
    } else {
      positional.push(arg);
    }
    i++;
  }
  return { positional, flags };
}

async function loginFromConfig(): Promise<void> {
  const cfg = loadConfig();
  await login(cfg.url, cfg.username, cfg.password);
}

export async function runDashboard(): Promise<void> {
  await loginFromConfig();
  const { getMe } = await import('./api.js');
  const text = await dashboard(api, getMe());
  console.log(text);
}

export async function runGetItem(rawArgs: string[]): Promise<void> {
  const { positional } = parseFlags(rawArgs);
  const id = Number(positional[0]);
  if (!id) die('Usage: viot-tasktisk get-item <item_id>');
  await loginFromConfig();
  const text = await getItem(api, { id });
  console.log(text);
}

export async function runAddTask(rawArgs: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rawArgs);
  const itemId = Number(positional[0]);
  const title = positional.slice(1).join(' ') || flags['title'];
  if (!itemId || !title) {
    die('Usage: viot-tasktisk add-task <item_id> <title> [--due YYYY-MM-DD] [--priority TB|Cao|Thấp] [--assignee <user_id>]');
  }
  await loginFromConfig();
  const text = await addTask(api, {
    item_id: itemId,
    title,
    due: flags['due'],
    priority: flags['priority'],
    assignee: flags['assignee'] ? Number(flags['assignee']) : undefined,
    descr: flags['descr'] ?? flags['description'],
  });
  console.log(text);
}

export async function runUpdateTask(rawArgs: string[]): Promise<void> {
  const { positional } = parseFlags(rawArgs);
  const id = Number(positional[0]);
  const status = positional[1];
  if (!id || !status) {
    die('Usage: viot-tasktisk update-task <task_id> <status>\n' +
        'Statuses: Plan · Todo · Doing · Done · Close · "Need help"');
  }
  await loginFromConfig();
  const text = await updateWork(api, { id, kind: 'task', status });
  console.log(text);
}

export async function runUpdateItem(rawArgs: string[]): Promise<void> {
  const { positional } = parseFlags(rawArgs);
  const id = Number(positional[0]);
  const status = positional[1];
  if (!id || !status) {
    die('Usage: viot-tasktisk update-item <item_id> <status>\n' +
        'Statuses: Todo · Doing · Review · Done · Cancelled');
  }
  await loginFromConfig();
  const text = await updateWork(api, { id, kind: 'item', status });
  console.log(text);
}

export async function runListUsers(): Promise<void> {
  await loginFromConfig();
  const text = await listUsers(api);
  console.log(text);
}

export async function runNotifications(rawArgs: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rawArgs);
  await loginFromConfig();
  let text: string;
  if (positional[0] === 'read') {
    const id = Number(positional[1]);
    if (!id) die('Usage: viot-tasktisk notifications read <notification_id>');
    text = await notifications(api, { mark_read: id });
  } else if (positional[0] === 'read-all') {
    text = await notifications(api, { mark_all_read: true });
  } else {
    text = await notifications(api, {
      unread_only: flags['unread'] === 'true',
      limit: flags['limit'] ? Number(flags['limit']) : undefined,
    });
  }
  console.log(text);
}

export async function runLogTime(rawArgs: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rawArgs);
  await loginFromConfig();
  let text: string;
  if (positional[0] === 'list') {
    text = await logTime(api, { action: 'list', date: flags['date'], from: flags['from'], to: flags['to'] });
  } else if (positional[0] === 'update') {
    const id = Number(positional[1]);
    if (!id) die('Usage: viot-tasktisk log-time update <log_id> [--minutes N] [--date YYYY-MM-DD] [--note text]');
    text = await logTime(api, {
      action: 'update',
      id,
      minutes: flags['minutes'] ? Number(flags['minutes']) : undefined,
      date: flags['date'],
      note: flags['note'],
    });
  } else if (positional[0] === 'delete') {
    const id = Number(positional[1]);
    if (!id) die('Usage: viot-tasktisk log-time delete <log_id>');
    text = await logTime(api, { action: 'delete', id });
  } else {
    const taskId = Number(positional[0]);
    const minutes = Number(positional[1]);
    if (!taskId || !minutes) {
      die('Usage: viot-tasktisk log-time <task_id> <minutes> [--date YYYY-MM-DD] [--note text]\n' +
          '       viot-tasktisk log-time list [--date YYYY-MM-DD] [--from ..] [--to ..]\n' +
          '       viot-tasktisk log-time update <log_id> [--minutes N] [--date ..] [--note ..]\n' +
          '       viot-tasktisk log-time delete <log_id>');
    }
    text = await logTime(api, { action: 'log', task_id: taskId, minutes, date: flags['date'], note: flags['note'] });
  }
  console.log(text);
}

export async function runComment(rawArgs: string[]): Promise<void> {
  const { positional } = parseFlags(rawArgs);
  const [sub, ...rest] = positional;
  await loginFromConfig();
  let text: string;
  switch (sub) {
    case 'list': {
      const entityType = rest[0] as CommentArgs['entity_type'];
      const entityId = Number(rest[1]);
      if (!entityType || !entityId) die('Usage: viot-tasktisk comment list <task|item|feature> <id>');
      text = await comment(api, { action: 'list', entity_type: entityType, entity_id: entityId });
      break;
    }
    case 'add': {
      const entityType = rest[0] as CommentArgs['entity_type'];
      const entityId = Number(rest[1]);
      const body = rest.slice(2).join(' ');
      if (!entityType || !entityId || !body) die('Usage: viot-tasktisk comment add <task|item|feature> <id> <text>');
      text = await comment(api, { action: 'add', entity_type: entityType, entity_id: entityId, text: body });
      break;
    }
    case 'update': {
      const id = Number(rest[0]);
      const body = rest.slice(1).join(' ');
      if (!id || !body) die('Usage: viot-tasktisk comment update <comment_id> <text>');
      text = await comment(api, { action: 'update', id, text: body });
      break;
    }
    case 'delete': {
      const id = Number(rest[0]);
      if (!id) die('Usage: viot-tasktisk comment delete <comment_id>');
      text = await comment(api, { action: 'delete', id });
      break;
    }
    default:
      die('Usage: viot-tasktisk comment <list|add|update|delete> ...');
  }
  console.log(text);
}

export function printHelp(): void {
  console.log(`viot-tasktisk — qlda-viot task tracking

MCP server (default, no subcommand):
  viot-tasktisk                       Start MCP server for Claude

Setup:
  viot-tasktisk setup                 Interactive setup wizard
  viot-tasktisk configure             Re-configure Claude integrations only
  viot-tasktisk update                Update to the latest version

Direct CLI commands (no MCP client needed):
  viot-tasktisk dashboard             Show your personal task dashboard
  viot-tasktisk my-tasks              Alias for dashboard
  viot-tasktisk get-item <id>         Show item detail with all child tasks
  viot-tasktisk add-task <item_id> <title> [options]
                                      Create a task under an item
    --due YYYY-MM-DD                  Due date
    --priority TB|Cao|Thấp            Priority
    --assignee <user_id>              Assign to user
    --descr <text>                    Description
  viot-tasktisk update-task <id> <status>
                                      Update task status
                                      (Plan/Todo/Doing/Done/Close/Need help)
  viot-tasktisk update-item <id> <status>
                                      Update item status
                                      (Todo/Doing/Review/Done/Cancelled)
  viot-tasktisk list-users            List all users (id, name, role)
  viot-tasktisk notifications [--unread] [--limit N]
                                      Show your notifications + unread count
  viot-tasktisk notifications read <id>
                                      Mark one notification as read
  viot-tasktisk notifications read-all
                                      Mark all notifications as read
  viot-tasktisk log-time <task_id> <minutes> [--date YYYY-MM-DD] [--note text]
                                      Log time spent on a task
  viot-tasktisk log-time list [--date YYYY-MM-DD] [--from .. --to ..]
                                      List your time logs
  viot-tasktisk log-time update <log_id> [--minutes N] [--date ..] [--note ..]
                                      Edit a time log entry
  viot-tasktisk log-time delete <log_id>
                                      Delete a time log entry
  viot-tasktisk comment list <task|item|feature> <id>
                                      List comments on an entity
  viot-tasktisk comment add <task|item|feature> <id> <text>
                                      Add a comment (use @Name to mention)
  viot-tasktisk comment update <comment_id> <text>
                                      Edit your own comment
  viot-tasktisk comment delete <comment_id>
                                      Delete your own comment

Environment variables override config file:
  QLDA_URL, QLDA_USERNAME, QLDA_PASSWORD
`);
}
