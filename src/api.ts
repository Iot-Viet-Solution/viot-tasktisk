export interface User {
  id: number;
  name: string;
  role: string;
}

export interface LoginRes {
  token: string;
  user: User;
}

let token: string | null = null;
let currentUser: User | null = null;
let baseUrl = '';

// ── Retry config ────────────────────────────────────────────────────────────
// Transient network failures and gateway errors (e.g. Cloudflare 524 "A Timeout
// Occurred") are common against the qlda-viot backend. Retry them with backoff
// instead of surfacing a raw failure on the first blip. Non-retryable errors
// (4xx other than 429, or a successful-but-error-shaped response) fail fast.

const DEFAULT_MAX_RETRIES = 3;
let maxRetries = DEFAULT_MAX_RETRIES;

/** Set how many times a request retries after a transient failure. Called once at startup from the resolved config. */
export function setMaxRetries(n: number): void {
  maxRetries = Number.isFinite(n) && n >= 0 ? n : DEFAULT_MAX_RETRIES;
}

const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504, 524]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** AbortSignal.timeout()/AbortController cancellations should fail fast, not retry —
 * the caller already chose a deadline (e.g. doctor's login check) or is tearing down. */
function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError');
}

/** Retries `doFetch` on network errors and on retryable gateway/rate-limit statuses, with exponential backoff. */
async function fetchWithRetry(doFetch: () => Promise<Response>): Promise<Response> {
  let attempt = 0;
  for (;;) {
    let res: Response | undefined;
    let networkErr: unknown;
    try {
      res = await doFetch();
    } catch (e) {
      if (isAbortError(e)) throw e;
      networkErr = e;
    }

    const retryableStatus = res !== undefined && RETRYABLE_STATUS.has(res.status);
    if (!networkErr && !retryableStatus) return res!;

    if (attempt >= maxRetries) {
      if (networkErr) throw networkErr;
      return res!;
    }
    attempt++;
    await sleep(Math.min(500 * 2 ** (attempt - 1), 8000));
  }
}

/** Builds a fallback message for a non-OK response whose body carried no `.error`. */
function httpErrorMessage(res: Response): string {
  const status = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
  if (!RETRYABLE_STATUS.has(res.status)) return status;
  return `${status} — gateway/timeout error, still failing after ${maxRetries} ${maxRetries === 1 ? 'retry' : 'retries'}`;
}

export async function login(base: string, username: string, password: string, signal?: AbortSignal): Promise<User> {
  baseUrl = base.replace(/\/$/, '');
  const res = await fetchWithRetry(() => fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    signal,
  }));
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Login failed: ${httpErrorMessage(res)}`);
  }
  const data = (await res.json()) as LoginRes;
  token = data.token;
  currentUser = data.user;
  return data.user;
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetchWithRetry(() => fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }));
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? httpErrorMessage(res));
  }
  return res.json() as Promise<T>;
}

export function getMe(): User | null {
  return currentUser;
}
