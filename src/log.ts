import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LOG_DIR = join(homedir(), '.config', 'viot-tasktisk', 'logs');
export const LOG_PATH = join(LOG_DIR, 'latest.log');
const MAX_BYTES = 1_000_000;

function rotateIfNeeded(): void {
  try {
    if (existsSync(LOG_PATH) && statSync(LOG_PATH).size > MAX_BYTES) {
      renameSync(LOG_PATH, join(LOG_DIR, 'previous.log'));
    }
  } catch { /* best effort */ }
}

/**
 * Append-only local log, independent of whatever the MCP client does with stderr.
 * Best-effort: never throws, never blocks the caller (e.g. a read-only home dir
 * just means no log gets written instead of crashing the server).
 */
export function log(line: string): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    rotateIfNeeded();
    appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${line}\n`);
  } catch { /* best effort */ }
}

/** Last `maxLines` lines of the current log file, or '' if none exists yet. */
export function tail(maxLines = 60): string {
  try {
    const content = readFileSync(LOG_PATH, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-maxLines).join('\n');
  } catch {
    return '';
  }
}
