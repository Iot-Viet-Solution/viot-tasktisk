import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { join, dirname } from 'node:path';

export type ConfigFormat =
  | 'mcp-servers'   // { mcpServers: { name: { command } } }  — Claude Desktop, Antigravity
  | 'vscode'        // { mcp: { servers: { name: { type, command } } } }
  | 'toml'          // [mcp_servers.<name>]\ncommand = "..."
  | 'claude-cli';   // managed via `claude mcp add/remove`, not a direct file edit — Claude Code

export interface ClaudeTarget {
  name: string;
  configPath: string;
  format: ConfigFormat;
}

// ── Targets ───────────────────────────────────────────────────────────────────

export function claudeDesktopTarget(): ClaudeTarget {
  const p = platform();
  let configPath: string;
  if (p === 'darwin') {
    configPath = join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (p === 'win32') {
    configPath = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  } else {
    configPath = join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
  return { name: 'Claude Desktop', configPath, format: 'mcp-servers' };
}

export function claudeCodeTarget(): ClaudeTarget {
  // Claude Code CLI does NOT read mcpServers from ~/.claude/settings.json — it's
  // managed exclusively through `claude mcp add/remove`, which stores user-scope
  // servers in ~/.claude.json. configPath here is informational only.
  return { name: 'Claude Code', configPath: join(homedir(), '.claude.json'), format: 'claude-cli' };
}

export function vscodeTarget(): ClaudeTarget {
  const p = platform();
  let configPath: string;
  if (p === 'darwin') {
    configPath = join(homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
  } else if (p === 'win32') {
    configPath = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Code', 'User', 'settings.json');
  } else {
    configPath = join(homedir(), '.config', 'Code', 'User', 'settings.json');
  }
  return { name: 'VS Code', configPath, format: 'vscode' };
}

export function antigravityTarget(): ClaudeTarget {
  // Google Antigravity CLI (replaced Gemini CLI Jun 2026)
  // Global MCP config lives under ~/.gemini/config/mcp_config.json
  return {
    name: 'Antigravity CLI (Google)',
    configPath: join(homedir(), '.gemini', 'config', 'mcp_config.json'),
    format: 'mcp-servers',
  };
}

export function codexTarget(): ClaudeTarget {
  // OpenAI Codex CLI — uses TOML at ~/.codex/config.toml
  return {
    name: 'Codex CLI (OpenAI)',
    configPath: join(homedir(), '.codex', 'config.toml'),
    format: 'toml',
  };
}

export function allTargets(): ClaudeTarget[] {
  return [
    claudeDesktopTarget(),
    claudeCodeTarget(),
    vscodeTarget(),
    antigravityTarget(),
    codexTarget(),
  ];
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

function readJson(path: string): Record<string, unknown> {
  try { return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>; }
  catch { return {}; }
}

function writeJson(path: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

// ── TOML helpers (no external dep — handles the specific mcp_servers shape) ───

function readToml(path: string): string {
  try { return readFileSync(path, 'utf-8'); } catch { return ''; }
}

function tomlHasSection(content: string, serverName: string): boolean {
  return content.includes(`[mcp_servers.${serverName}]`);
}

function injectToml(filePath: string, serverName: string, command: string): void {
  let content = readToml(filePath);
  const section = `[mcp_servers.${serverName}]`;

  if (tomlHasSection(content, serverName)) {
    // Update the command value inside the existing section
    content = content.replace(
      new RegExp(
        `(\\[mcp_servers\\.${serverName.replace(/\./g, '\\.')}\\][\\s\\S]*?\\ncommand\\s*=\\s*)("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|[^\\s"'][^\\n]*)`,
      ),
      `$1"${command}"`,
    );
  } else {
    if (content && !content.endsWith('\n')) content += '\n';
    content += `\n${section}\ncommand = "${command}"\n`;
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function injectMcpServer(target: ClaudeTarget, command: string): void {
  if (target.format === 'toml') {
    injectToml(target.configPath, 'viot-tasks', command);
    return;
  }

  if (target.format === 'claude-cli') {
    // Idempotent: drop any existing entry first so re-running configure updates
    // the command instead of erroring on a duplicate name.
    try { execFileSync('claude', ['mcp', 'remove', '-s', 'user', 'viot-tasks'], { stdio: 'ignore' }); }
    catch { /* wasn't configured yet */ }
    execFileSync('claude', ['mcp', 'add', '-s', 'user', 'viot-tasks', '--', command]);
    return;
  }

  const cfg = readJson(target.configPath);

  if (target.format === 'vscode') {
    const mcp = (cfg.mcp ?? {}) as Record<string, unknown>;
    const servers = (mcp.servers ?? {}) as Record<string, unknown>;
    cfg.mcp = { ...mcp, servers: { ...servers, 'viot-tasks': { type: 'stdio', command } } };
  } else {
    // 'mcp-servers' — Claude Desktop, Claude Code, Antigravity
    const servers = (cfg.mcpServers ?? {}) as Record<string, unknown>;
    cfg.mcpServers = { ...servers, 'viot-tasks': { command } };
  }

  writeJson(target.configPath, cfg);
}

export function isAlreadyConfigured(target: ClaudeTarget): boolean {
  if (!existsSync(target.configPath)) return false;
  try {
    if (target.format === 'toml') {
      return tomlHasSection(readToml(target.configPath), 'viot-tasks');
    }
    if (target.format === 'claude-cli') {
      const servers = (readJson(target.configPath).mcpServers ?? {}) as Record<string, unknown>;
      return !!servers['viot-tasks'];
    }
    const cfg = readJson(target.configPath);
    if (target.format === 'vscode') {
      const servers = ((cfg.mcp as Record<string, unknown>)?.servers ?? {}) as Record<string, unknown>;
      return !!servers['viot-tasks'];
    }
    return !!((cfg.mcpServers ?? {}) as Record<string, unknown>)['viot-tasks'];
  } catch { return false; }
}

/**
 * Every target here spawns the MCP server as its own subprocess rather than
 * through your interactive shell, so none of them see a PATH change that
 * only lives in ~/.bashrc or ~/.zshrc (the standard user-local install setup).
 * Global installs land in a directory that's already on the default PATH for
 * every shell type, so the short name is fine there.
 */
export function resolveCommand(installPrefix: string | undefined): string {
  if (!installPrefix) return 'viot-tasktisk';
  return join(installPrefix, 'bin', 'viot-tasktisk');
}
