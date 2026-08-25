import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Config {
  url: string;
  username: string;
  password: string;
  /** npm prefix used at install time. undefined = global, path = user-local. */
  installPrefix?: string;
  /** Retry attempts for transient API failures (network errors, 429/502/503/504/524). Default 3. */
  maxRetries?: number;
}

export const CONFIG_PATH = join(homedir(), '.config', 'viot-tasktisk', 'config.json');

export function loadConfig(): Config {
  // Env vars take priority over config file
  if (process.env.QLDA_URL && process.env.QLDA_USERNAME && process.env.QLDA_PASSWORD) {
    return {
      url: process.env.QLDA_URL,
      username: process.env.QLDA_USERNAME,
      password: process.env.QLDA_PASSWORD,
      maxRetries: process.env.QLDA_MAX_RETRIES ? Number(process.env.QLDA_MAX_RETRIES) : undefined,
    };
  }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Config;
  } catch {
    throw new Error(
      'No config found. Run `viot-tasktisk setup` to configure, ' +
      'or set QLDA_URL, QLDA_USERNAME, and QLDA_PASSWORD env vars.'
    );
  }
}
