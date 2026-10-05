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

/** Pulls the best human-readable message out of a non-OK JSON body:
 *  {error}, {message}, {error:{message}}, or provider-SDK shapes like
 *  {data:{message, statusCode, isRetryable}} (e.g. "Data leak protection
 *  rejected"). */
function bodyMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  for (const key of ['error', 'message']) {
    const v = b[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object') {
      const m = (v as Record<string, unknown>).message;
      if (typeof m === 'string' && m.trim()) return m.trim();
    }
  }
  const d = b.data;
  if (d && typeof d === 'object') {
    const m = (d as Record<string, unknown>).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  return null;
}

/** Reads a non-OK response and turns it into a useful Error, keeping the
 *  upstream's own message (and status) instead of a bare "HTTP 4xx". */
async function httpError(res: Response): Promise<Error> {
  const raw = await res.text().catch(() => '');
  let body: unknown = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* not JSON */ }
  const msg = bodyMessage(body) ?? (raw.trim() ? raw.slice(0, 300).trim() : null);
  return new Error(msg ? `${msg} (HTTP ${res.status})` : httpErrorMessage(res));
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
    throw new Error(`Login failed: ${(await httpError(res)).message}`);
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
  if (!res.ok) throw await httpError(res);
  return res.json() as Promise<T>;
}

export interface BinaryRes {
  data: Buffer;
  mimeType: string;
  /** Filename from Content-Disposition (RFC 5987 `filename*=UTF-8''…`), if the server sent one. */
  filename: string | null;
}

/** GET a raw file (e.g. `/att/:id`) instead of JSON. Refuses bodies over `maxBytes` before reading them. */
export async function apiBinary(path: string, maxBytes = Infinity): Promise<BinaryRes> {
  const res = await fetchWithRetry(() => fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
  if (!res.ok) throw await httpError(res);
  const declared = Number(res.headers.get('content-length'));
  if (declared > maxBytes) throw new Error(`File too large: ${declared} bytes (limit ${maxBytes})`);
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length > maxBytes) throw new Error(`File too large: ${data.length} bytes (limit ${maxBytes})`);
  const cd = res.headers.get('content-disposition') || '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i);
  let filename: string | null = null;
  if (m) { try { filename = decodeURIComponent(m[1]); } catch { filename = m[1]; } }
  return { data, mimeType: (res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim(), filename };
}

export function getMe(): User | null {
  return currentUser;
}
