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

export async function login(base: string, username: string, password: string): Promise<User> {
  baseUrl = base.replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Login failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as LoginRes;
  token = data.token;
  currentUser = data.user;
  return data.user;
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getMe(): User | null {
  return currentUser;
}
