import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_PATH } from './config.js';
import type { Config } from './config.js';

const REPO = 'github:Iot-Viet-Solution/viot-tasktisk';

/** Try to infer the install prefix from the binary's own path. */
function detectPrefixFromBinary(): string | undefined {
  const argv1 = process.argv[1] ?? '';
  const candidates = [
    join(homedir(), '.npm-global'),
    join(homedir(), '.npm'),
    join(homedir(), 'npm'),
    join(homedir(), '.local'),
    join(homedir(), '.nvm'),   // nvm installs are per-user
  ];
  return candidates.find(p => argv1.startsWith(p));
}

function resolvePrefix(): string | undefined {
  // 1. Config file (written by install.sh → setup)
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Config;
    if (cfg.installPrefix) return cfg.installPrefix;
  } catch { /* no config yet */ }

  // 2. Fallback: sniff binary path
  return detectPrefixFromBinary();
}

export async function runUpdate(): Promise<void> {
  console.log('viot-tasktisk — update\n');

  const prefix = resolvePrefix();

  const npmArgs = ['install', '-g'];
  if (prefix) {
    npmArgs.push('--prefix', prefix);
    console.log(`Install mode : user-local (${prefix})`);
  } else {
    console.log('Install mode : global');
  }
  npmArgs.push(REPO);

  console.log(`Running      : npm ${npmArgs.join(' ')}\n`);

  try {
    execFileSync('npm', npmArgs, { stdio: 'inherit' });
  } catch {
    console.error('\nUpdate failed. Try running the command above manually.');
    process.exit(1);
  }

  console.log('\n✓ Updated successfully.');
  console.log('  Restart Claude Desktop to load the new version.');
}
