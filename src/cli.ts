/**
 * Direct CLI commands — no MCP client needed.
 * These run as a one-shot process: login → call skill → print → exit.
 */

import { login, api } from './api.js';
import { dashboard, updateWork, addTask, getItem } from './skills.js';
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

Environment variables override config file:
  QLDA_URL, QLDA_USERNAME, QLDA_PASSWORD
`);
}
