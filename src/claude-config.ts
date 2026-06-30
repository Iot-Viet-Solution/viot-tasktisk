import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, dirname } from 'node:path';

export interface ClaudeTarget {
  name: string;
  configPath: string;
}

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
  return { name: 'Claude Desktop', configPath };
}

export function claudeCodeTarget(): ClaudeTarget {
  return {
    name: 'Claude Code',
    configPath: join(homedir(), '.claude', 'settings.json'),
  };
}

function readJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Inject or overwrite the `viot-tasks` entry in mcpServers of a Claude config file.
 * Creates the file (and parent dirs) if it doesn't exist yet.
 */
export function injectMcpServer(target: ClaudeTarget, command: string): void {
  const cfg = readJson(target.configPath);
  const existing = (cfg.mcpServers ?? {}) as Record<string, unknown>;
  cfg.mcpServers = { ...existing, 'viot-tasks': { command } };
  mkdirSync(dirname(target.configPath), { recursive: true });
  writeFileSync(target.configPath, JSON.stringify(cfg, null, 2) + '\n');
}

export function isAlreadyConfigured(target: ClaudeTarget): boolean {
  if (!existsSync(target.configPath)) return false;
  try {
    const cfg = JSON.parse(readFileSync(target.configPath, 'utf-8')) as Record<string, unknown>;
    const servers = cfg.mcpServers as Record<string, unknown> | undefined;
    return !!servers?.['viot-tasks'];
  } catch {
    return false;
  }
}

/**
 * Resolve the command string to use in config.
 * User-local installs may not be on Claude Desktop's PATH, so use the full binary path there.
 * Claude Code (CLI) inherits the user's shell PATH, so short name is fine.
 */
export function resolveCommand(installPrefix: string | undefined, target: ClaudeTarget): string {
  if (!installPrefix) return 'viot-tasktisk'; // global — on PATH everywhere
  const fullPath = join(installPrefix, 'bin', 'viot-tasktisk');
  // Claude Code runs in the terminal where PATH is already set — short name is safe.
  if (target.name === 'Claude Code') return 'viot-tasktisk';
  // Claude Desktop launches without a full shell PATH — use absolute path.
  return fullPath;
}
