import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_PATH } from './config.js';
import type { Config } from './config.js';

// Injected by tsup at build time
declare const __PKG_VERSION__: string;
const LOCAL_VERSION: string =
  typeof __PKG_VERSION__ !== 'undefined' ? __PKG_VERSION__ : 'dev';

const REMOTE_PKG =
  'https://raw.githubusercontent.com/Iot-Viet-Solution/viot-tasktisk/main/package.json';
const RELEASE_BASE = 'https://github.com/Iot-Viet-Solution/viot-tasktisk/releases/download';

// ── Update state (module-level, shared between startup check and skills) ──────

let _updateAvailable: string | null = null;

/** Returns the latest remote version if an update is available, else null. */
export function getUpdateAvailable(): string | null {
  return _updateAvailable;
}

export function getLocalVersion(): string {
  return LOCAL_VERSION;
}

// ── Startup background check ──────────────────────────────────────────────────

/**
 * Fire-and-forget: fetch the remote package.json and compare versions.
 * Never throws — network failures are silently ignored.
 * Writes to stderr if an update is available (visible in Claude Desktop logs).
 */
export function startUpdateCheck(): void {
  void (async () => {
    try {
      const res = await fetch(REMOTE_PKG, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return;
      const remote = (await res.json()) as { version?: string };
      if (remote.version && remote.version !== LOCAL_VERSION) {
        _updateAvailable = remote.version;
        process.stderr.write(
          `[viot-tasktisk] Update available: ${LOCAL_VERSION} → ${remote.version}\n` +
          `  Run: viot-tasktisk update\n`,
        );
      }
    } catch {
      // Silently ignore — never disrupt server startup
    }
  })();
}

// ── npm install prefix resolution ─────────────────────────────────────────────

function detectPrefixFromBinary(): string | undefined {
  const argv1 = process.argv[1] ?? '';
  const candidates = [
    join(homedir(), '.npm-global'),
    join(homedir(), '.npm'),
    join(homedir(), 'npm'),
    join(homedir(), '.local'),
    join(homedir(), '.nvm'),
  ];
  return candidates.find(p => argv1.startsWith(p));
}

function resolvePrefix(): string | undefined {
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Config;
    if (cfg.installPrefix) return cfg.installPrefix;
  } catch { /* no config */ }
  return detectPrefixFromBinary();
}

// ── viot-tasktisk update ──────────────────────────────────────────────────────

export async function runUpdate(): Promise<void> {
  console.log('viot-tasktisk — update\n');
  console.log(`Current version : ${LOCAL_VERSION}`);

  let remoteVersion: string | undefined;
  try {
    const res = await fetch(REMOTE_PKG, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const pkg = (await res.json()) as { version?: string };
      remoteVersion = pkg.version;
    }
  } catch { /* network unavailable */ }

  if (remoteVersion) {
    if (remoteVersion === LOCAL_VERSION) {
      console.log(`Remote version  : ${remoteVersion} (already up to date)`);
      return;
    }
    console.log(`Remote version  : ${remoteVersion} ← installing this`);
  } else {
    console.log('Remote version  : (could not fetch, proceeding anyway)');
    remoteVersion = LOCAL_VERSION;
  }

  const tarballUrl = `${RELEASE_BASE}/v${remoteVersion}/viot-tasktisk-${remoteVersion}.tgz`;

  const prefix = resolvePrefix();
  const npmArgs = ['install', '-g'];
  if (prefix) {
    npmArgs.push('--prefix', prefix);
    console.log(`Install mode    : user-local (${prefix})`);
  } else {
    console.log('Install mode    : global');
  }
  npmArgs.push(tarballUrl);

  console.log(`\nRunning: npm ${npmArgs.join(' ')}\n`);

  try {
    execFileSync('npm', npmArgs, { stdio: 'inherit' });
  } catch {
    console.error('\nUpdate failed. Try running the command above manually.');
    process.exit(1);
  }

  console.log('\n✓ Updated successfully.');
  console.log('  Restart Claude Desktop to load the new version.');
}
