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

// src/api.ts
var api_exports = {};
__export(api_exports, {
  api: () => api,
  getMe: () => getMe,
  login: () => login
});
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
var token, currentUser, baseUrl;
var init_api = __esm({
  "src/api.ts"() {
    "use strict";
    token = null;
    currentUser = null;
    baseUrl = "";
  }
});

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
  let remoteVersion;
  try {
    const res = await fetch(REMOTE_PKG, { signal: AbortSignal.timeout(6e3) });
    if (res.ok) {
      const pkg = await res.json();
      remoteVersion = pkg.version;
    }
  } catch {
  }
  if (remoteVersion) {
    if (remoteVersion === LOCAL_VERSION) {
      console.log(`Remote version  : ${remoteVersion} (already up to date)`);
      return;
    }
    console.log(`Remote version  : ${remoteVersion} \u2190 installing this`);
  } else {
    console.log("Remote version  : (could not fetch, proceeding anyway)");
    remoteVersion = LOCAL_VERSION;
  }
  const tarballUrl = `${RELEASE_BASE}/v${remoteVersion}/viot-tasktisk-${remoteVersion}.tgz`;
  const prefix = resolvePrefix();
  const npmArgs = ["install", "-g"];
  if (prefix) {
    npmArgs.push("--prefix", prefix);
    console.log(`Install mode    : user-local (${prefix})`);
  } else {
    console.log("Install mode    : global");
  }
  npmArgs.push(tarballUrl);
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
var LOCAL_VERSION, REMOTE_PKG, RELEASE_BASE, _updateAvailable;
var init_update = __esm({
  "src/update.ts"() {
    "use strict";
    init_config();
    LOCAL_VERSION = true ? "1.0.0" : "dev";
    REMOTE_PKG = "https://raw.githubusercontent.com/Iot-Viet-Solution/viot-tasktisk/main/package.json";
    RELEASE_BASE = "https://github.com/Iot-Viet-Solution/viot-tasktisk/releases/download";
    _updateAvailable = null;
  }
});

// src/skills.ts
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
var init_skills = __esm({
  "src/skills.ts"() {
    "use strict";
    init_update();
  }
});

// src/claude-config.ts
import { readFileSync as readFileSync3, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir as homedir3, platform } from "os";
import { join as join3, dirname } from "path";
function claudeDesktopTarget() {
  const p = platform();
  let configPath;
  if (p === "darwin") {
    configPath = join3(homedir3(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (p === "win32") {
    configPath = join3(process.env.APPDATA ?? join3(homedir3(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  } else {
    configPath = join3(homedir3(), ".config", "Claude", "claude_desktop_config.json");
  }
  return { name: "Claude Desktop", configPath, format: "mcp-servers" };
}
function claudeCodeTarget() {
  return { name: "Claude Code", configPath: join3(homedir3(), ".claude", "settings.json"), format: "mcp-servers" };
}
function vscodeTarget() {
  const p = platform();
  let configPath;
  if (p === "darwin") {
    configPath = join3(homedir3(), "Library", "Application Support", "Code", "User", "settings.json");
  } else if (p === "win32") {
    configPath = join3(process.env.APPDATA ?? join3(homedir3(), "AppData", "Roaming"), "Code", "User", "settings.json");
  } else {
    configPath = join3(homedir3(), ".config", "Code", "User", "settings.json");
  }
  return { name: "VS Code", configPath, format: "vscode" };
}
function antigravityTarget() {
  return {
    name: "Antigravity CLI (Google)",
    configPath: join3(homedir3(), ".gemini", "config", "mcp_config.json"),
    format: "mcp-servers"
  };
}
function codexTarget() {
  return {
    name: "Codex CLI (OpenAI)",
    configPath: join3(homedir3(), ".codex", "config.toml"),
    format: "toml"
  };
}
function allTargets() {
  return [
    claudeDesktopTarget(),
    claudeCodeTarget(),
    vscodeTarget(),
    antigravityTarget(),
    codexTarget()
  ];
}
function readJson(path) {
  try {
    return JSON.parse(readFileSync3(path, "utf-8"));
  } catch {
    return {};
  }
}
function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}
function readToml(path) {
  try {
    return readFileSync3(path, "utf-8");
  } catch {
    return "";
  }
}
function tomlHasSection(content, serverName) {
  return content.includes(`[mcp_servers.${serverName}]`);
}
function injectToml(filePath, serverName, command) {
  let content = readToml(filePath);
  const section = `[mcp_servers.${serverName}]`;
  if (tomlHasSection(content, serverName)) {
    content = content.replace(
      new RegExp(
        `(\\[mcp_servers\\.${serverName.replace(/\./g, "\\.")}\\][\\s\\S]*?\\ncommand\\s*=\\s*)("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|[^\\s"'][^\\n]*)`
      ),
      `$1"${command}"`
    );
  } else {
    if (content && !content.endsWith("\n")) content += "\n";
    content += `
${section}
command = "${command}"
`;
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}
function injectMcpServer(target, command) {
  if (target.format === "toml") {
    injectToml(target.configPath, "viot-tasks", command);
    return;
  }
  const cfg2 = readJson(target.configPath);
  if (target.format === "vscode") {
    const mcp = cfg2.mcp ?? {};
    const servers = mcp.servers ?? {};
    cfg2.mcp = { ...mcp, servers: { ...servers, "viot-tasks": { type: "stdio", command } } };
  } else {
    const servers = cfg2.mcpServers ?? {};
    cfg2.mcpServers = { ...servers, "viot-tasks": { command } };
  }
  writeJson(target.configPath, cfg2);
}
function isAlreadyConfigured(target) {
  if (!existsSync(target.configPath)) return false;
  try {
    if (target.format === "toml") {
      return tomlHasSection(readToml(target.configPath), "viot-tasks");
    }
    const cfg2 = readJson(target.configPath);
    if (target.format === "vscode") {
      const servers = cfg2.mcp?.servers ?? {};
      return !!servers["viot-tasks"];
    }
    return !!(cfg2.mcpServers ?? {})["viot-tasks"];
  } catch {
    return false;
  }
}
function resolveCommand(installPrefix, target) {
  if (!installPrefix || target.name !== "Claude Desktop") return "viot-tasktisk";
  return join3(installPrefix, "bin", "viot-tasktisk");
}
var init_claude_config = __esm({
  "src/claude-config.ts"() {
    "use strict";
  }
});

// src/setup.ts
var setup_exports = {};
__export(setup_exports, {
  runConfigure: () => runConfigure,
  runSetup: () => runSetup
});
import { createInterface } from "readline/promises";
import { writeFileSync as writeFileSync2, mkdirSync as mkdirSync2, existsSync as existsSync2, readFileSync as readFileSync4 } from "fs";
import { dirname as dirname2 } from "path";
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
async function runConfigure(installPrefix) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const targets = allTargets();
  let anyConfigured = false;
  console.log("Configure Claude integrations:\n");
  for (const target of targets) {
    const already = isAlreadyConfigured(target);
    const hint = already ? " (already configured \u2014 overwrite?)" : "";
    const ans = await rl.question(`  ${target.name}${hint} [Y/n]: `);
    if (/^n/i.test(ans.trim())) continue;
    const command = resolveCommand(installPrefix, target);
    injectMcpServer(target, command);
    console.log(`  \u2713 ${target.name} \u2192 ${target.configPath}`);
    if (command !== "viot-tasktisk") {
      console.log(`    (using full path: ${command})`);
    }
    anyConfigured = true;
  }
  rl.close();
  if (anyConfigured) {
    console.log("\nRestart Claude Desktop / reload Claude Code to apply changes.");
  } else {
    console.log("\nNo changes made.");
    console.log("Add manually to either config file:");
    console.log(JSON.stringify(
      { mcpServers: { "viot-tasks": { command: "viot-tasktisk" } } },
      null,
      2
    ));
  }
}
async function runSetup() {
  console.log("viot-tasktisk \u2014 setup wizard\n");
  let existing = {};
  if (existsSync2(CONFIG_PATH)) {
    try {
      existing = JSON.parse(readFileSync4(CONFIG_PATH, "utf-8"));
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
  const password = await readPassword("Password: ");
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
  mkdirSync2(dirname2(CONFIG_PATH), { recursive: true });
  writeFileSync2(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", { mode: 384 });
  console.log(`
\u2713 Credentials saved to ${CONFIG_PATH}
`);
  await runConfigure(installPrefix);
}
var init_setup = __esm({
  "src/setup.ts"() {
    "use strict";
    init_config();
    init_claude_config();
  }
});

// src/cli.ts
var cli_exports = {};
__export(cli_exports, {
  printHelp: () => printHelp,
  runAddTask: () => runAddTask,
  runDashboard: () => runDashboard,
  runGetItem: () => runGetItem,
  runUpdateItem: () => runUpdateItem,
  runUpdateTask: () => runUpdateTask
});
function die(msg, code = 1) {
  process.stderr.write(msg + "\n");
  process.exit(code);
}
function parseFlags(argv) {
  const positional = [];
  const flags = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags[arg.slice(2)] = argv[++i];
      } else {
        flags[arg.slice(2)] = "true";
      }
    } else {
      positional.push(arg);
    }
    i++;
  }
  return { positional, flags };
}
async function loginFromConfig() {
  const cfg2 = loadConfig();
  await login(cfg2.url, cfg2.username, cfg2.password);
}
async function runDashboard() {
  await loginFromConfig();
  const { getMe: getMe2 } = await Promise.resolve().then(() => (init_api(), api_exports));
  const text = await dashboard(api, getMe2());
  console.log(text);
}
async function runGetItem(rawArgs) {
  const { positional } = parseFlags(rawArgs);
  const id = Number(positional[0]);
  if (!id) die("Usage: viot-tasktisk get-item <item_id>");
  await loginFromConfig();
  const text = await getItem(api, { id });
  console.log(text);
}
async function runAddTask(rawArgs) {
  const { positional, flags } = parseFlags(rawArgs);
  const itemId = Number(positional[0]);
  const title = positional.slice(1).join(" ") || flags["title"];
  if (!itemId || !title) {
    die("Usage: viot-tasktisk add-task <item_id> <title> [--due YYYY-MM-DD] [--priority TB|Cao|Th\u1EA5p] [--assignee <user_id>]");
  }
  await loginFromConfig();
  const text = await addTask(api, {
    item_id: itemId,
    title,
    due: flags["due"],
    priority: flags["priority"],
    assignee: flags["assignee"] ? Number(flags["assignee"]) : void 0,
    descr: flags["descr"] ?? flags["description"]
  });
  console.log(text);
}
async function runUpdateTask(rawArgs) {
  const { positional } = parseFlags(rawArgs);
  const id = Number(positional[0]);
  const status = positional[1];
  if (!id || !status) {
    die('Usage: viot-tasktisk update-task <task_id> <status>\nStatuses: Plan \xB7 Todo \xB7 Doing \xB7 Done \xB7 Close \xB7 "Need help"');
  }
  await loginFromConfig();
  const text = await updateWork(api, { id, kind: "task", status });
  console.log(text);
}
async function runUpdateItem(rawArgs) {
  const { positional } = parseFlags(rawArgs);
  const id = Number(positional[0]);
  const status = positional[1];
  if (!id || !status) {
    die("Usage: viot-tasktisk update-item <item_id> <status>\nStatuses: Todo \xB7 Doing \xB7 Review \xB7 Done \xB7 Cancelled");
  }
  await loginFromConfig();
  const text = await updateWork(api, { id, kind: "item", status });
  console.log(text);
}
function printHelp() {
  console.log(`viot-tasktisk \u2014 qlda-viot task tracking

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
    --priority TB|Cao|Th\u1EA5p            Priority
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
var init_cli = __esm({
  "src/cli.ts"() {
    "use strict";
    init_api();
    init_skills();
    init_config();
  }
});

// src/index.ts
init_api();
init_skills();
init_config();
init_update();
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
var subcommand = process.argv[2];
var subArgs = process.argv.slice(3);
if (subcommand === "setup") {
  const { runSetup: runSetup2 } = await Promise.resolve().then(() => (init_setup(), setup_exports));
  await runSetup2();
  process.exit(0);
}
if (subcommand === "configure") {
  const { runConfigure: runConfigure2 } = await Promise.resolve().then(() => (init_setup(), setup_exports));
  let prefix;
  try {
    prefix = loadConfig().installPrefix;
  } catch {
  }
  await runConfigure2(prefix);
  process.exit(0);
}
if (subcommand === "update") {
  const { runUpdate: runUpdate2 } = await Promise.resolve().then(() => (init_update(), update_exports));
  await runUpdate2();
  process.exit(0);
}
if (subcommand === "dashboard" || subcommand === "my-tasks") {
  const { runDashboard: runDashboard2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
  await runDashboard2();
  process.exit(0);
}
if (subcommand === "get-item") {
  const { runGetItem: runGetItem2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
  await runGetItem2(subArgs);
  process.exit(0);
}
if (subcommand === "add-task") {
  const { runAddTask: runAddTask2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
  await runAddTask2(subArgs);
  process.exit(0);
}
if (subcommand === "update-task") {
  const { runUpdateTask: runUpdateTask2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
  await runUpdateTask2(subArgs);
  process.exit(0);
}
if (subcommand === "update-item") {
  const { runUpdateItem: runUpdateItem2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
  await runUpdateItem2(subArgs);
  process.exit(0);
}
if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
  const { printHelp: printHelp2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
  printHelp2();
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
