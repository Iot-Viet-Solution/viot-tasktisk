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
    LOCAL_VERSION = true ? "1.1.0" : "dev";
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
async function listUsers(apiFn) {
  const users = await apiFn("GET", "/users");
  if (!users.length) return "_No users found._";
  return ["# Users", ...users.map((u) => `- [user:${u.id}] ${u.name} (${u.role})`)].join("\n");
}
async function notifications(apiFn, args = {}) {
  const { unread_only, limit, mark_read, mark_all_read } = args;
  if (mark_all_read) {
    await apiFn("PATCH", "/me/notifications/read-all");
    return "Marked all notifications as read.";
  }
  if (mark_read != null) {
    await apiFn("PATCH", `/notifications/${mark_read}/read`);
    return `Marked notification #${mark_read} as read.`;
  }
  const qs = new URLSearchParams();
  if (limit != null) qs.set("limit", String(limit));
  if (unread_only) qs.set("unread", "1");
  const query = qs.toString();
  const [list, unreadList] = await Promise.all([
    apiFn("GET", `/me/notifications${query ? `?${query}` : ""}`),
    apiFn("GET", "/me/notifications?unread=1&limit=500")
  ]);
  const lines = [`# Notifications (${unreadList.length} unread)`];
  if (!list.length) {
    lines.push("_No notifications._");
  } else {
    list.forEach((n) => {
      const ref = n.ref_type && n.ref_id ? ` [${n.ref_type}:${n.ref_id}]` : "";
      const mark = n.read_at ? "" : " \u{1F535}";
      lines.push(`- [notif:${n.id}]${mark} ${n.body}${ref} \xB7 ${n.created}`);
    });
  }
  return lines.join("\n");
}
function fmtHours(minutes) {
  return (minutes / 60).toFixed(1).replace(/\.0$/, "");
}
function fmtLog(l, bullet = true) {
  const note = l.note ? ` \u2014 ${l.note}` : "";
  const prefix = bullet ? "- " : "";
  return `${prefix}[log:${l.id}] task:${l.task_id} ${l.date} \xB7 ${fmtHours(l.minutes)}h${note}`;
}
async function logTime(apiFn, args) {
  const { action, task_id, id, minutes, date, from, to, note } = args;
  if (action === "log") {
    if (task_id == null || minutes == null) throw new Error("task_id and minutes are required to log time");
    const log = await apiFn("POST", "/me/task-logs", { task_id, minutes, date, note });
    return `Logged ${fmtHours(log.minutes)}h on task #${log.task_id} (${log.date})`;
  }
  if (action === "update") {
    if (id == null) throw new Error("id is required to update a time log");
    const log = await apiFn("PATCH", `/task-logs/${id}`, { minutes, date, note });
    return `Updated ${fmtLog(log, false)}`;
  }
  if (action === "delete") {
    if (id == null) throw new Error("id is required to delete a time log");
    await apiFn("DELETE", `/task-logs/${id}`);
    return `Deleted log #${id}`;
  }
  const qs = new URLSearchParams();
  if (from && to) {
    qs.set("from", from);
    qs.set("to", to);
  } else if (date) qs.set("date", date);
  const query = qs.toString();
  const logs = await apiFn("GET", `/me/task-logs${query ? `?${query}` : ""}`);
  if (!logs.length) return "_No time logs found._";
  const totalMinutes = logs.reduce((s, l) => s + l.minutes, 0);
  return [`# Time Logs (${fmtHours(totalMinutes)}h total)`, ...logs.map((l) => fmtLog(l))].join("\n");
}
async function comment(apiFn, args) {
  const { action, entity_type, entity_id, id, text } = args;
  if (action === "add") {
    if (!entity_type || entity_id == null || !text) {
      throw new Error("entity_type, entity_id, and text are required to add a comment");
    }
    const att = await apiFn("POST", `/attachments/${entity_type}/${entity_id}`, { kind: "comment", text });
    return `Added comment #${att.id} to ${entity_type}:${entity_id}`;
  }
  if (action === "update") {
    if (id == null || !text) throw new Error("id and text are required to update a comment");
    const att = await apiFn("PATCH", `/attachments/${id}`, { text });
    return `Updated comment #${att.id}`;
  }
  if (action === "delete") {
    if (id == null) throw new Error("id is required to delete a comment");
    await apiFn("DELETE", `/attachments/${id}`);
    return `Deleted comment #${id}`;
  }
  if (!entity_type || entity_id == null) {
    throw new Error("entity_type and entity_id are required to list comments");
  }
  const items = await apiFn("GET", `/attachments/${entity_type}/${entity_id}`);
  const cmts = items.filter((a) => a.kind === "comment");
  if (!cmts.length) return `_No comments on ${entity_type}:${entity_id}._`;
  return [
    `# Comments on ${entity_type}:${entity_id} (${cmts.length})`,
    ...cmts.map((c) => `- [comment:${c.id}] user:${c.user_id ?? "?"} (${c.created ?? "\u2014"}): ${c.text}`)
  ].join("\n");
}
var init_skills = __esm({
  "src/skills.ts"() {
    "use strict";
    init_update();
  }
});

// src/claude-config.ts
import { readFileSync as readFileSync3, writeFileSync, mkdirSync, existsSync } from "fs";
import { execFileSync as execFileSync2 } from "child_process";
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
  return { name: "Claude Code", configPath: join3(homedir3(), ".claude.json"), format: "claude-cli" };
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
  if (target.format === "claude-cli") {
    try {
      execFileSync2("claude", ["mcp", "remove", "-s", "user", "viot-tasks"], { stdio: "ignore" });
    } catch {
    }
    execFileSync2("claude", ["mcp", "add", "-s", "user", "viot-tasks", "--", command]);
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
    if (target.format === "claude-cli") {
      const servers = readJson(target.configPath).mcpServers ?? {};
      return !!servers["viot-tasks"];
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
function resolveCommand(installPrefix) {
  if (!installPrefix) return "viot-tasktisk";
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
    const command = resolveCommand(installPrefix);
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
  const envUrl = process.env.QLDA_URL?.trim();
  const envUsername = process.env.QLDA_USERNAME?.trim();
  const envPassword = process.env.QLDA_PASSWORD;
  let url;
  let username;
  let password;
  if (envUrl && envUsername && envPassword) {
    console.log("Using QLDA_URL / QLDA_USERNAME / QLDA_PASSWORD from environment.\n");
    url = envUrl;
    username = envUsername;
    password = envPassword;
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const urlDefault = existing.url ?? "http://localhost:3100";
    const rawUrl = await rl.question(`QLDA API URL [${urlDefault}]: `);
    url = rawUrl.trim() || urlDefault;
    const rawUser = await rl.question(`Username${existing.username ? ` [${existing.username}]` : ""}: `);
    username = rawUser.trim() || existing.username || "";
    rl.close();
    password = await readPassword("Password: ");
  }
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
  runComment: () => runComment,
  runDashboard: () => runDashboard,
  runGetItem: () => runGetItem,
  runListUsers: () => runListUsers,
  runLogTime: () => runLogTime,
  runNotifications: () => runNotifications,
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
async function runListUsers() {
  await loginFromConfig();
  const text = await listUsers(api);
  console.log(text);
}
async function runNotifications(rawArgs) {
  const { positional, flags } = parseFlags(rawArgs);
  await loginFromConfig();
  let text;
  if (positional[0] === "read") {
    const id = Number(positional[1]);
    if (!id) die("Usage: viot-tasktisk notifications read <notification_id>");
    text = await notifications(api, { mark_read: id });
  } else if (positional[0] === "read-all") {
    text = await notifications(api, { mark_all_read: true });
  } else {
    text = await notifications(api, {
      unread_only: flags["unread"] === "true",
      limit: flags["limit"] ? Number(flags["limit"]) : void 0
    });
  }
  console.log(text);
}
async function runLogTime(rawArgs) {
  const { positional, flags } = parseFlags(rawArgs);
  await loginFromConfig();
  let text;
  if (positional[0] === "list") {
    text = await logTime(api, { action: "list", date: flags["date"], from: flags["from"], to: flags["to"] });
  } else if (positional[0] === "update") {
    const id = Number(positional[1]);
    if (!id) die("Usage: viot-tasktisk log-time update <log_id> [--minutes N] [--date YYYY-MM-DD] [--note text]");
    text = await logTime(api, {
      action: "update",
      id,
      minutes: flags["minutes"] ? Number(flags["minutes"]) : void 0,
      date: flags["date"],
      note: flags["note"]
    });
  } else if (positional[0] === "delete") {
    const id = Number(positional[1]);
    if (!id) die("Usage: viot-tasktisk log-time delete <log_id>");
    text = await logTime(api, { action: "delete", id });
  } else {
    const taskId = Number(positional[0]);
    const minutes = Number(positional[1]);
    if (!taskId || !minutes) {
      die("Usage: viot-tasktisk log-time <task_id> <minutes> [--date YYYY-MM-DD] [--note text]\n       viot-tasktisk log-time list [--date YYYY-MM-DD] [--from ..] [--to ..]\n       viot-tasktisk log-time update <log_id> [--minutes N] [--date ..] [--note ..]\n       viot-tasktisk log-time delete <log_id>");
    }
    text = await logTime(api, { action: "log", task_id: taskId, minutes, date: flags["date"], note: flags["note"] });
  }
  console.log(text);
}
async function runComment(rawArgs) {
  const { positional } = parseFlags(rawArgs);
  const [sub, ...rest] = positional;
  await loginFromConfig();
  let text;
  switch (sub) {
    case "list": {
      const entityType = rest[0];
      const entityId = Number(rest[1]);
      if (!entityType || !entityId) die("Usage: viot-tasktisk comment list <task|item|feature> <id>");
      text = await comment(api, { action: "list", entity_type: entityType, entity_id: entityId });
      break;
    }
    case "add": {
      const entityType = rest[0];
      const entityId = Number(rest[1]);
      const body = rest.slice(2).join(" ");
      if (!entityType || !entityId || !body) die("Usage: viot-tasktisk comment add <task|item|feature> <id> <text>");
      text = await comment(api, { action: "add", entity_type: entityType, entity_id: entityId, text: body });
      break;
    }
    case "update": {
      const id = Number(rest[0]);
      const body = rest.slice(1).join(" ");
      if (!id || !body) die("Usage: viot-tasktisk comment update <comment_id> <text>");
      text = await comment(api, { action: "update", id, text: body });
      break;
    }
    case "delete": {
      const id = Number(rest[0]);
      if (!id) die("Usage: viot-tasktisk comment delete <comment_id>");
      text = await comment(api, { action: "delete", id });
      break;
    }
    default:
      die("Usage: viot-tasktisk comment <list|add|update|delete> ...");
  }
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

// src/errors.ts
function formatError(err) {
  if (err instanceof Error) {
    const cause = err.cause;
    switch (cause?.code) {
      case "EAI_AGAIN":
      case "ENOTFOUND":
        return `Could not resolve host${cause.hostname ? ` "${cause.hostname}"` : ""} \u2014 check the url in your config (run \`viot-tasktisk setup\` to fix it).`;
      case "ECONNREFUSED":
        return "Connection refused \u2014 is the QLDA server running and reachable at that url?";
      case "ETIMEDOUT":
      case "UND_ERR_CONNECT_TIMEOUT":
        return "Connection timed out \u2014 check the url in your config and your network.";
    }
    return err.message;
  }
  return String(err);
}

// src/index.ts
process.on("uncaughtException", (err) => {
  process.stderr.write(`viot-tasktisk: ${formatError(err)}
`);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`viot-tasktisk: ${formatError(reason)}
`);
  process.exit(1);
});
var subcommand = process.argv[2];
var subArgs = process.argv.slice(3);
var commands = {
  setup: async () => {
    const { runSetup: runSetup2 } = await Promise.resolve().then(() => (init_setup(), setup_exports));
    await runSetup2();
  },
  configure: async () => {
    const { runConfigure: runConfigure2 } = await Promise.resolve().then(() => (init_setup(), setup_exports));
    let prefix;
    try {
      prefix = loadConfig().installPrefix;
    } catch {
    }
    await runConfigure2(prefix);
  },
  update: async () => {
    const { runUpdate: runUpdate2 } = await Promise.resolve().then(() => (init_update(), update_exports));
    await runUpdate2();
  },
  dashboard: async () => {
    const { runDashboard: runDashboard2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
    await runDashboard2();
  },
  "my-tasks": async () => {
    const { runDashboard: runDashboard2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
    await runDashboard2();
  },
  "get-item": async (args) => {
    const { runGetItem: runGetItem2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
    await runGetItem2(args);
  },
  "add-task": async (args) => {
    const { runAddTask: runAddTask2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
    await runAddTask2(args);
  },
  "update-task": async (args) => {
    const { runUpdateTask: runUpdateTask2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
    await runUpdateTask2(args);
  },
  "update-item": async (args) => {
    const { runUpdateItem: runUpdateItem2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
    await runUpdateItem2(args);
  },
  "list-users": async () => {
    const { runListUsers: runListUsers2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
    await runListUsers2();
  },
  notifications: async (args) => {
    const { runNotifications: runNotifications2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
    await runNotifications2(args);
  },
  "log-time": async (args) => {
    const { runLogTime: runLogTime2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
    await runLogTime2(args);
  },
  comment: async (args) => {
    const { runComment: runComment2 } = await Promise.resolve().then(() => (init_cli(), cli_exports));
    await runComment2(args);
  },
  "--help": async () => {
    (await Promise.resolve().then(() => (init_cli(), cli_exports))).printHelp();
  },
  "-h": async () => {
    (await Promise.resolve().then(() => (init_cli(), cli_exports))).printHelp();
  },
  help: async () => {
    (await Promise.resolve().then(() => (init_cli(), cli_exports))).printHelp();
  }
};
if (subcommand && subcommand in commands) {
  try {
    await commands[subcommand](subArgs);
  } catch (e) {
    process.stderr.write(`viot-tasktisk: ${formatError(e)}
`);
    process.exit(1);
  }
  process.exit(0);
}
var cfg;
try {
  cfg = loadConfig();
} catch (e) {
  process.stderr.write(`${formatError(e)}
`);
  process.exit(1);
}
try {
  const me = await login(cfg.url, cfg.username, cfg.password);
  process.stderr.write(`viot-tasktisk: logged in as ${me.name} (${me.role})
`);
  startUpdateCheck();
} catch (e) {
  process.stderr.write(`Login failed: ${formatError(e)}
`);
  process.exit(1);
}
var server = new Server(
  { name: "viot-tasktisk", version: "1.1.0" },
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
    },
    {
      name: "list_users",
      description: "List all users (id, name, role) \u2014 use to resolve a name to a user id for assignment.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "notifications",
      description: "List your notifications (assignments, mentions, comments, completions) with unread count, or mark one/all as read.",
      inputSchema: {
        type: "object",
        properties: {
          unread_only: { type: "boolean", description: "Only show unread notifications (optional)" },
          limit: { type: "number", description: "Max notifications to return (optional, default 50)" },
          mark_read: { type: "number", description: "Notification ID to mark as read (optional)" },
          mark_all_read: { type: "boolean", description: "Mark all your notifications as read (optional)" }
        }
      }
    },
    {
      name: "log_time",
      description: 'Log, list, update, or delete time spent on tasks (your personal timesheet). "log" records new time; "list" shows your logs by date or range; "update"/"delete" modify an existing log entry.',
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["log", "list", "update", "delete"], description: "Operation to perform" },
          task_id: { type: "number", description: 'Task ID (required for action="log")' },
          id: { type: "number", description: 'Time log ID (required for action="update"/"delete")' },
          minutes: { type: "number", description: 'Minutes worked (required for "log", optional for "update")' },
          date: { type: "string", description: "Date YYYY-MM-DD (optional, defaults to today)" },
          from: { type: "string", description: 'Range start YYYY-MM-DD (for action="list")' },
          to: { type: "string", description: 'Range end YYYY-MM-DD (for action="list")' },
          note: { type: "string", description: "Optional note" }
        },
        required: ["action"]
      }
    },
    {
      name: "comment",
      description: "List, add, update, or delete comments on a task, item, or feature. Adding a comment on a task notifies its assignee; use @Name in the text to also notify a mentioned user.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "add", "update", "delete"], description: "Operation to perform" },
          entity_type: { type: "string", enum: ["task", "item", "feature"], description: 'Entity type (required for "list"/"add")' },
          entity_id: { type: "number", description: 'Entity ID (required for "list"/"add")' },
          id: { type: "number", description: 'Comment ID (required for "update"/"delete")' },
          text: { type: "string", description: 'Comment text (required for "add"/"update")' }
        },
        required: ["action"]
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
      case "list_users":
        text = await listUsers(api);
        break;
      case "notifications":
        text = await notifications(api, args);
        break;
      case "log_time":
        text = await logTime(api, args);
        break;
      case "comment":
        text = await comment(api, args);
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
