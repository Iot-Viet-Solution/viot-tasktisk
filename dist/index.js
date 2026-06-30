#!/usr/bin/env node
#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/config.ts
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
function loadConfig() {
  if (process.env.QLDA_URL && process.env.QLDA_USERNAME && process.env.QLDA_PASSWORD) {
    return {
      url: process.env.QLDA_URL,
      username: process.env.QLDA_USERNAME,
      password: process.env.QLDA_PASSWORD
    };
  }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    throw new Error(
      "No config found. Run `viot-tasktisk setup` to configure, or set QLDA_URL, QLDA_USERNAME, and QLDA_PASSWORD env vars."
    );
  }
}
var CONFIG_PATH;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    CONFIG_PATH = join(homedir(), ".config", "viot-tasktisk", "config.json");
  }
});

// src/update.ts
var update_exports = {};
__export(update_exports, {
  getLocalVersion: () => getLocalVersion,
  getUpdateAvailable: () => getUpdateAvailable,
  runUpdate: () => runUpdate,
  startUpdateCheck: () => startUpdateCheck
});
import { execFileSync } from "child_process";
import { readFileSync as readFileSync2 } from "fs";
import { homedir as homedir2 } from "os";
import { join as join2 } from "path";
function getUpdateAvailable() {
  return _updateAvailable;
}
function getLocalVersion() {
  return LOCAL_VERSION;
}
function startUpdateCheck() {
  void (async () => {
    try {
      const res = await fetch(REMOTE_PKG, { signal: AbortSignal.timeout(6e3) });
      if (!res.ok) return;
      const remote = await res.json();
      if (remote.version && remote.version !== LOCAL_VERSION) {
        _updateAvailable = remote.version;
        process.stderr.write(
          `[viot-tasktisk] Update available: ${LOCAL_VERSION} \u2192 ${remote.version}
  Run: viot-tasktisk update
`
        );
      }
    } catch {
    }
  })();
}
function detectPrefixFromBinary() {
  const argv1 = process.argv[1] ?? "";
  const candidates = [
    join2(homedir2(), ".npm-global"),
    join2(homedir2(), ".npm"),
    join2(homedir2(), "npm"),
    join2(homedir2(), ".local"),
    join2(homedir2(), ".nvm")
  ];
  return candidates.find((p) => argv1.startsWith(p));
}
function resolvePrefix() {
  try {
    const cfg2 = JSON.parse(readFileSync2(CONFIG_PATH, "utf-8"));
    if (cfg2.installPrefix) return cfg2.installPrefix;
  } catch {
  }
  return detectPrefixFromBinary();
}
async function runUpdate() {
  console.log("viot-tasktisk \u2014 update\n");
  console.log(`Current version : ${LOCAL_VERSION}`);
  try {
    const res = await fetch(REMOTE_PKG, { signal: AbortSignal.timeout(6e3) });
    if (res.ok) {
      const remote = await res.json();
      if (remote.version) {
        if (remote.version === LOCAL_VERSION) {
          console.log(`Remote version  : ${remote.version} (already up to date)`);
          return;
        }
        console.log(`Remote version  : ${remote.version} \u2190 installing this`);
      }
    }
  } catch {
    console.log("Remote version  : (could not fetch, proceeding anyway)");
  }
  const prefix = resolvePrefix();
  const npmArgs = ["install", "-g"];
  if (prefix) {
    npmArgs.push("--prefix", prefix);
    console.log(`Install mode    : user-local (${prefix})`);
  } else {
    console.log("Install mode    : global");
  }
  npmArgs.push(REPO);
  console.log(`
Running: npm ${npmArgs.join(" ")}
`);
  try {
    execFileSync("npm", npmArgs, { stdio: "inherit" });
  } catch {
    console.error("\nUpdate failed. Try running the command above manually.");
    process.exit(1);
  }
  console.log("\n\u2713 Updated successfully.");
  console.log("  Restart Claude Desktop to load the new version.");
}
var LOCAL_VERSION, REPO, REMOTE_PKG, _updateAvailable;
var init_update = __esm({
  "src/update.ts"() {
    "use strict";
    init_config();
    LOCAL_VERSION = true ? "1.0.0" : "dev";
    REPO = "github:Iot-Viet-Solution/viot-tasktisk";
    REMOTE_PKG = "https://raw.githubusercontent.com/Iot-Viet-Solution/viot-tasktisk/main/package.json";
    _updateAvailable = null;
  }
});

// src/setup.ts
var setup_exports = {};
__export(setup_exports, {
  runSetup: () => runSetup
});
import { createInterface } from "readline/promises";
import { writeFileSync, mkdirSync, existsSync, readFileSync as readFileSync3 } from "fs";
import { dirname } from "path";
function readPassword(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    let value = "";
    const stdin = process.stdin;
    const rawSupported = typeof stdin.setRawMode === "function";
    if (rawSupported) stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    function onData(ch) {
      if (ch === "\r" || ch === "\n") {
        if (rawSupported) stdin.setRawMode(false);
        stdin.removeListener("data", onData);
        stdin.pause();
        process.stdout.write("\n");
        resolve(value);
      } else if (ch === "") {
        process.exit(0);
      } else if (ch === "\x7F") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else {
        value += ch;
        process.stdout.write("*");
      }
    }
    stdin.on("data", onData);
  });
}
async function runSetup() {
  console.log("viot-tasktisk \u2014 setup wizard\n");
  let existing = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      existing = JSON.parse(readFileSync3(CONFIG_PATH, "utf-8"));
      console.log(`Updating existing config: ${CONFIG_PATH}
`);
    } catch {
    }
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const urlDefault = existing.url ?? "http://localhost:3100";
  const rawUrl = await rl.question(`QLDA API URL [${urlDefault}]: `);
  const url = rawUrl.trim() || urlDefault;
  const rawUser = await rl.question(`Username${existing.username ? ` [${existing.username}]` : ""}: `);
  const username = rawUser.trim() || existing.username || "";
  rl.close();
  const password = await readPassword(`Password: `);
  if (!username) {
    console.error("\nUsername is required.");
    process.exit(1);
  }
  if (!password) {
    console.error("\nPassword is required.");
    process.exit(1);
  }
  const installPrefix = process.env.VIOT_INSTALL_PREFIX?.trim() || existing.installPrefix;
  const config = { url, username, password, ...installPrefix ? { installPrefix } : {} };
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", { mode: 384 });
  console.log(`
\u2713 Config saved to ${CONFIG_PATH}
`);
  console.log("Add this to your Claude Desktop config:\n");
  console.log(JSON.stringify(
    { mcpServers: { "viot-tasks": { command: "viot-tasktisk" } } },
    null,
    2
  ));
  console.log("\nThen restart Claude Desktop.");
}
var init_setup = __esm({
  "src/setup.ts"() {
    "use strict";
    init_config();
  }
});

// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// src/api.ts
var token = null;
var currentUser = null;
var baseUrl = "";
async function login(base, username, password) {
  baseUrl = base.replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Login failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  token = data.token;
  currentUser = data.user;
  return data.user;
}
async function api(method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: body !== void 0 ? JSON.stringify(body) : void 0
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}
function getMe() {
  return currentUser;
}

// src/skills.ts
init_update();
function currentWeek() {
  const d = /* @__PURE__ */ new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((+d - +yearStart) / 864e5 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function todayStr() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function weekEndStr() {
  const d = /* @__PURE__ */ new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + (7 - day));
  return d.toISOString().slice(0, 10);
}
function fmtTask(t) {
  const parts = [`[task:${t.id}] ${t.title}`, `(${t.status ?? "Todo"})`];
  if (t.pname) parts.push(`\xB7 proj:${t.pname}`);
  if (t.feature_name) parts.push(`> feat:${t.feature_name}`);
  if (t.item_title) parts.push(`> item:${t.item_title}`);
  if (t.due) parts.push(`due:${t.due}`);
  if (t.priority === "Cao") parts.push("[HIGH]");
  return parts.join(" ");
}
async function dashboard(apiFn, me) {
  const [tasks, prio] = await Promise.all([
    apiFn("GET", "/mytasks"),
    apiFn("GET", `/priorities?week=${currentWeek()}`).catch(
      () => ({ week: currentWeek(), items: [] })
    )
  ]);
  const tod = todayStr();
  const wend = weekEndStr();
  const doneStatuses = /* @__PURE__ */ new Set(["Done", "Close", "Cancelled"]);
  const active = tasks.filter((t) => !doneStatuses.has(t.status ?? ""));
  const overdue = active.filter((t) => t.due && t.due < tod);
  const dueToday = active.filter((t) => t.due === tod);
  const dueWeek = active.filter((t) => t.due && t.due > tod && t.due <= wend);
  const later = active.filter((t) => !t.due || t.due > wend);
  const finished = tasks.filter((t) => doneStatuses.has(t.status ?? ""));
  const newVersion = getUpdateAvailable();
  const lines = [
    `# Dashboard \u2014 ${me?.name ?? "Me"} \xB7 ${tod} (${prio.week})`,
    ...newVersion ? [`
> \u2B06\uFE0F  Update available: ${getLocalVersion()} \u2192 **${newVersion}** \u2014 run \`viot-tasktisk update\` then restart Claude Desktop.`] : [],
    ""
  ];
  if (overdue.length) {
    lines.push(`## \u{1F534} Overdue (${overdue.length})`);
    overdue.forEach((t) => lines.push("- " + fmtTask(t)));
    lines.push("");
  }
  if (dueToday.length) {
    lines.push(`## \u{1F7E1} Due Today (${dueToday.length})`);
    dueToday.forEach((t) => lines.push("- " + fmtTask(t)));
    lines.push("");
  }
  if (dueWeek.length) {
    lines.push(`## \u{1F7E2} This Week (${dueWeek.length})`);
    dueWeek.forEach((t) => lines.push("- " + fmtTask(t)));
    lines.push("");
  }
  if (later.length) {
    lines.push(`## \u2B1C Later / No Due (${later.length})`);
    later.forEach((t) => lines.push("- " + fmtTask(t)));
    lines.push("");
  }
  if (finished.length) {
    lines.push(`## \u2705 Done / Closed (${finished.length})`);
    finished.forEach((t) => lines.push("- " + fmtTask(t)));
    lines.push("");
  }
  if (!tasks.length) lines.push("_No tasks assigned to you._");
  const prioItems = prio.items ?? [];
  if (prioItems.length) {
    lines.push(`## \u{1F4CC} Weekly Priorities (${prio.week})`);
    [...prioItems].sort((a, b) => a.rank - b.rank).forEach((p) => {
      const label = p.project_name ?? "\u2014";
      const note = p.note ? ` \u2014 ${p.note}` : "";
      lines.push(`${p.rank}. ${label}${note}`);
    });
  }
  return lines.join("\n");
}
async function updateWork(apiFn, args) {
  const { id, kind, status, due, priority } = args;
  const path = kind === "task" ? `/tasks/${id}` : `/items/${id}`;
  const patch = { status };
  if (due !== void 0) patch.due = due;
  if (priority !== void 0) patch.priority = priority;
  const result = await apiFn("PATCH", path, patch);
  const parts = [`Updated ${kind} #${id} \u2192 ${result.status ?? status}`];
  if (result.due) parts.push(`due:${result.due}`);
  if (result.priority) parts.push(`priority:${result.priority}`);
  if (result.done_at) parts.push(`done_at:${result.done_at}`);
  return parts.join(" \xB7 ");
}
async function addTask(apiFn, args) {
  const { item_id, title, descr, due, priority, assignee } = args;
  const payload = { title };
  if (descr) payload.descr = descr;
  if (due) payload.due = due;
  if (priority) payload.priority = priority;
  if (assignee != null) payload.assignee = assignee;
  const task = await apiFn("POST", `/items/${item_id}/tasks`, payload);
  return `Created task #${task.id}: "${task.title}" under item #${item_id}` + (task.due ? ` \xB7 due:${task.due}` : "");
}
async function getItem(apiFn, { id }) {
  const item = await apiFn("GET", `/items/${id}`);
  const lines = [
    `# Item #${item.id}: ${item.title}`,
    `Type: ${item.type} | Status: ${item.status} | Priority: ${item.priority}`,
    `Feature: ${item.feature_name ?? "\u2014"} | Sprint: ${item.sprint_name ?? "none"}`,
    `Assignee: ${item.assignee_name ?? "unassigned"}`,
    `Progress: ${item.task_done}/${item.task_total} tasks (${item.task_pct}%)`
  ];
  if (item.description) lines.push("", `Description: ${item.description}`);
  if (item.acceptance_criteria) lines.push("", `Acceptance criteria: ${item.acceptance_criteria}`);
  const tasks = item.tasks ?? [];
  if (tasks.length) {
    lines.push("", `## Tasks (${tasks.length})`);
    tasks.forEach((t) => {
      const due = t.due ? ` due:${t.due}` : "";
      const hi = t.priority === "Cao" ? " [HIGH]" : "";
      lines.push(`- [task:${t.id}] [${t.status ?? "Todo"}] ${t.title}${due}${hi}`);
    });
  } else {
    lines.push("", "_No tasks yet._");
  }
  return lines.join("\n");
}

// src/index.ts
init_config();
init_update();
var subcommand = process.argv[2];
if (subcommand === "setup") {
  const { runSetup: runSetup2 } = await Promise.resolve().then(() => (init_setup(), setup_exports));
  await runSetup2();
  process.exit(0);
}
if (subcommand === "update") {
  const { runUpdate: runUpdate2 } = await Promise.resolve().then(() => (init_update(), update_exports));
  await runUpdate2();
  process.exit(0);
}
var cfg;
try {
  cfg = loadConfig();
} catch (e) {
  process.stderr.write(`${e.message}
`);
  process.exit(1);
}
try {
  const me = await login(cfg.url, cfg.username, cfg.password);
  process.stderr.write(`viot-tasktisk: logged in as ${me.name} (${me.role})
`);
  startUpdateCheck();
} catch (e) {
  process.stderr.write(`Login failed: ${e.message}
`);
  process.exit(1);
}
var server = new Server(
  { name: "viot-tasktisk", version: "1.0.0" },
  { capabilities: { tools: {} } }
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "dashboard",
      description: "Get your personal task dashboard: tasks grouped by urgency (overdue / due today / this week / later / done) plus the team's weekly priorities. Call this first to understand what to work on.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "update_work",
      description: "Update the status (and optionally due date or priority) of a task or item. Task statuses: Plan \xB7 Todo \xB7 Doing \xB7 Done \xB7 Close \xB7 Need help. Item statuses: Todo \xB7 Doing \xB7 Review \xB7 Done \xB7 Cancelled.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "ID shown in dashboard as task:N or item:N" },
          kind: { type: "string", enum: ["task", "item"], description: '"task" or "item"' },
          status: { type: "string", description: "New status (see valid values in description)" },
          due: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
          priority: { type: "string", enum: ["Cao", "TB", "Th\u1EA5p"], description: "Priority (optional)" }
        },
        required: ["id", "kind", "status"]
      }
    },
    {
      name: "get_item",
      description: "Get full detail of an Item: type, status, sprint, assignee, description, acceptance criteria, and all child tasks with statuses and due dates.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "Item ID" }
        },
        required: ["id"]
      }
    },
    {
      name: "add_task",
      description: "Create a new task under an existing Item.",
      inputSchema: {
        type: "object",
        properties: {
          item_id: { type: "number", description: "Parent Item ID" },
          title: { type: "string", description: "Task title" },
          descr: { type: "string", description: "Description (optional)" },
          due: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
          priority: { type: "string", enum: ["Cao", "TB", "Th\u1EA5p"], description: "Priority (optional)" },
          assignee: { type: "number", description: "User ID to assign (optional)" }
        },
        required: ["item_id", "title"]
      }
    }
  ]
}));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    let text;
    switch (name) {
      case "dashboard":
        text = await dashboard(api, getMe());
        break;
      case "update_work":
        text = await updateWork(api, args);
        break;
      case "get_item":
        text = await getItem(api, args);
        break;
      case "add_task":
        text = await addTask(api, args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text }] };
  } catch (e) {
    return {
      content: [{ type: "text", text: `Error: ${e.message}` }],
      isError: true
    };
  }
});
var transport = new StdioServerTransport();
await server.connect(transport);
