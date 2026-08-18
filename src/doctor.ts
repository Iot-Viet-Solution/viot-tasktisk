/**
 * `viot-tasktisk doctor` — collects everything needed to diagnose a "run failed"
 * report without needing access to the user's machine: environment, config,
 * connectivity, per-client MCP registration state, and the tail of the local
 * log file. Users run this and paste the output back to whoever supports them.
 */
import { existsSync, readFileSync } from 'node:fs';
import { platform } from 'node:os';
import { CONFIG_PATH } from './config.js';
import type { Config } from './config.js';
import { login } from './api.js';
import { formatError } from './errors.js';
import { getLocalVersion, fetchRemoteVersion } from './update.js';
import { allTargets, isAlreadyConfigured, getConfiguredCommand } from './claude-config.js';
import { LOG_PATH, tail } from './log.js';

function row(label: string, value: string): string {
  return `  ${label.padEnd(20)} ${value}`;
}

export async function runDoctor(): Promise<void> {
  const out: string[] = ['viot-tasktisk — doctor', ''];

  out.push('Environment');
  out.push(row('Node version', process.version));
  out.push(row('Platform', `${platform()} ${process.arch}`));
  out.push(row('Binary path', process.argv[1] ?? '(unknown)'));
  out.push(row('Installed version', getLocalVersion()));
  const remote = await fetchRemoteVersion();
  out.push(row(
    'Latest version',
    remote
      ? remote === getLocalVersion() ? `${remote} (up to date)` : `${remote} (update available — run 'viot-tasktisk update')`
      : '(could not fetch — check network)',
  ));
  out.push('');

  out.push('Config');
  const envActive = !!(process.env.QLDA_URL && process.env.QLDA_USERNAME && process.env.QLDA_PASSWORD);
  let cfg: Config | undefined;
  if (envActive) {
    out.push(row('Source', 'QLDA_URL / QLDA_USERNAME / QLDA_PASSWORD env vars'));
    cfg = { url: process.env.QLDA_URL!, username: process.env.QLDA_USERNAME!, password: process.env.QLDA_PASSWORD! };
  } else {
    out.push(row('Source', `config file (${CONFIG_PATH})`));
    if (!existsSync(CONFIG_PATH)) {
      out.push(row('Config file', 'NOT FOUND — run `viot-tasktisk setup`'));
    } else {
      try {
        cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Config;
        out.push(row('Config file', 'found, valid JSON'));
      } catch (e) {
        out.push(row('Config file', `found but NOT valid JSON — ${formatError(e)}`));
      }
    }
  }
  if (cfg) {
    out.push(row('URL', cfg.url));
    out.push(row('Username', cfg.username));
    out.push(row('Password', cfg.password ? `set (${cfg.password.length} chars)` : 'NOT SET'));
    out.push(row('Install prefix', cfg.installPrefix ?? '(global)'));
  }
  out.push('');

  out.push('Connectivity');
  if (cfg) {
    try {
      const res = await fetch(cfg.url, { signal: AbortSignal.timeout(5000) });
      out.push(row('URL reachable', `yes (HTTP ${res.status})`));
    } catch (e) {
      out.push(row('URL reachable', `NO — ${formatError(e)}`));
    }
    try {
      const me = await login(cfg.url, cfg.username, cfg.password);
      out.push(row('Login', `OK — logged in as ${me.name} (${me.role})`));
    } catch (e) {
      out.push(row('Login', `FAILED — ${formatError(e)}`));
    }
  } else {
    out.push(row('Skipped', 'no usable config to test'));
  }
  out.push('');

  out.push('Claude client registrations');
  for (const target of allTargets()) {
    if (!isAlreadyConfigured(target)) {
      out.push(row(target.name, 'not configured'));
      continue;
    }
    const cmd = getConfiguredCommand(target);
    let status = `registered → ${cmd ?? '(command not found in config)'}`;
    if (cmd && cmd !== 'viot-tasktisk' && !existsSync(cmd)) {
      status += '  ⚠ that path does not exist on disk — re-run `viot-tasktisk configure`';
    }
    out.push(row(target.name, status));
  }
  out.push('');

  out.push(`Recent log (${LOG_PATH})`);
  const recent = tail(40);
  out.push(recent ? recent.split('\n').map(l => '  ' + l).join('\n') : '  (no log entries yet)');

  console.log(out.join('\n'));
}
