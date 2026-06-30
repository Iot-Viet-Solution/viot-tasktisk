import { createInterface } from 'node:readline/promises';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { CONFIG_PATH } from './config.js';
import type { Config } from './config.js';

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

export async function runSetup(): Promise<void> {
  console.log('viot-tasktisk — setup wizard\n');

  let existing: Partial<Config> = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      existing = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Config;
      console.log(`Updating existing config: ${CONFIG_PATH}\n`);
    } catch { /* ignore parse errors, start fresh */ }
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const urlDefault = existing.url ?? 'http://localhost:3100';
  const rawUrl = await rl.question(`QLDA API URL [${urlDefault}]: `);
  const url = rawUrl.trim() || urlDefault;

  const rawUser = await rl.question(`Username${existing.username ? ` [${existing.username}]` : ''}: `);
  const username = rawUser.trim() || existing.username || '';

  rl.close();

  const password = await readPassword(`Password: `);

  if (!username) { console.error('\nUsername is required.'); process.exit(1); }
  if (!password) { console.error('\nPassword is required.'); process.exit(1); }

  // Preserve installPrefix set by install.sh (via VIOT_INSTALL_PREFIX env var)
  // or already stored from a previous setup.
  const installPrefix = process.env.VIOT_INSTALL_PREFIX?.trim() || existing.installPrefix;

  const config: Config = { url, username, password, ...(installPrefix ? { installPrefix } : {}) };
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });

  console.log(`\n✓ Config saved to ${CONFIG_PATH}\n`);
  console.log('Add this to your Claude Desktop config:\n');
  console.log(JSON.stringify(
    { mcpServers: { 'viot-tasks': { command: 'viot-tasktisk' } } },
    null, 2
  ));
  console.log('\nThen restart Claude Desktop.');
}
