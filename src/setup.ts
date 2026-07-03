import { createInterface } from 'node:readline/promises';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { CONFIG_PATH } from './config.js';
import type { Config } from './config.js';
import {
  allTargets,
  injectMcpServer,
  isAlreadyConfigured,
  resolveCommand,
} from './claude-config.js';

// ── Password input with * masking ─────────────────────────────────────────────

function readPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    let value = '';
    const stdin = process.stdin as NodeJS.ReadStream & { setRawMode?: (mode: boolean) => void };
    const rawSupported = typeof stdin.setRawMode === 'function';
    if (rawSupported) stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();

    function onData(ch: string) {
      if (ch === '\r' || ch === '\n') {
        if (rawSupported) stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        stdin.pause();
        process.stdout.write('\n');
        resolve(value);
      } else if (ch === '') {
        process.exit(0);
      } else if (ch === '') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        value += ch;
        process.stdout.write('*');
      }
    }
    stdin.on('data', onData);
  });
}

// ── Claude integration config step (reusable) ─────────────────────────────────

export async function runConfigure(installPrefix?: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const targets = allTargets();
  let anyConfigured = false;

  console.log('Configure Claude integrations:\n');

  for (const target of targets) {
    const already = isAlreadyConfigured(target);
    const hint = already ? ' (already configured — overwrite?)' : '';
    const ans = await rl.question(`  ${target.name}${hint} [Y/n]: `);
    if (/^n/i.test(ans.trim())) continue;

    const command = resolveCommand(installPrefix);
    injectMcpServer(target, command);
    console.log(`  ✓ ${target.name} → ${target.configPath}`);
    if (command !== 'viot-tasktisk') {
      console.log(`    (using full path: ${command})`);
    }
    anyConfigured = true;
  }

  rl.close();

  if (anyConfigured) {
    console.log('\nRestart Claude Desktop / reload Claude Code to apply changes.');
  } else {
    console.log('\nNo changes made.');
    console.log('Add manually to either config file:');
    console.log(JSON.stringify(
      { mcpServers: { 'viot-tasks': { command: 'viot-tasktisk' } } },
      null, 2
    ));
  }
}

// ── Full setup wizard (credentials + configure) ───────────────────────────────

export async function runSetup(): Promise<void> {
  console.log('viot-tasktisk — setup wizard\n');

  let existing: Partial<Config> = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      existing = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Config;
      console.log(`Updating existing config: ${CONFIG_PATH}\n`);
    } catch { /* start fresh */ }
  }

  const envUrl = process.env.QLDA_URL?.trim();
  const envUsername = process.env.QLDA_USERNAME?.trim();
  const envPassword = process.env.QLDA_PASSWORD;

  let url: string;
  let username: string;
  let password: string;

  if (envUrl && envUsername && envPassword) {
    console.log('Using QLDA_URL / QLDA_USERNAME / QLDA_PASSWORD from environment.\n');
    url = envUrl;
    username = envUsername;
    password = envPassword;
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    const urlDefault = existing.url ?? 'http://localhost:3100';
    const rawUrl = await rl.question(`QLDA API URL [${urlDefault}]: `);
    url = rawUrl.trim() || urlDefault;

    const rawUser = await rl.question(`Username${existing.username ? ` [${existing.username}]` : ''}: `);
    username = rawUser.trim() || existing.username || '';

    rl.close();

    password = await readPassword('Password: ');
  }

  if (!username) { console.error('\nUsername is required.'); process.exit(1); }
  if (!password) { console.error('\nPassword is required.'); process.exit(1); }

  const installPrefix = process.env.VIOT_INSTALL_PREFIX?.trim() || existing.installPrefix;
  const config: Config = { url, username, password, ...(installPrefix ? { installPrefix } : {}) };

  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  console.log(`\n✓ Credentials saved to ${CONFIG_PATH}\n`);

  await runConfigure(installPrefix);
}
