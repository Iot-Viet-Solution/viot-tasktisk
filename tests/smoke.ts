/**
 * Smoke test — exercises every skill against the live qlda-viot server.
 * Run: npx tsx tests/smoke.ts
 * Expects: QLDA_URL=http://localhost:3100 (default)
 */

import { login, api } from '../src/api.js';
import { dashboard, updateWork, addTask, getItem } from '../src/skills.js';

const BASE = process.env.QLDA_URL ?? 'http://localhost:3100';

const SEED_USERS = [
  { username: 'cuong', role: 'admin' },
  { username: 'tu',    role: 'tuvan' },
  { username: 'ha',    role: 'ba' },
  { username: 'pm',    role: 'pm' },
  { username: 'tai',   role: 'designer' },
  { username: 'thanh', role: 'dev' },
  { username: 'qanh',  role: 'qa' },
  { username: 'sep',   role: 'bld' },
] as const;

const PASSWORD = '123456';

// ── helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label: string, detail?: string) {
  console.log(`  ✓ ${label}${detail ? `  — ${detail}` : ''}`);
  passed++;
}

function fail(label: string, err: unknown) {
  console.error(`  ✗ ${label}  — ${(err as Error).message ?? err}`);
  failed++;
}

async function section(title: string, fn: () => Promise<void>) {
  console.log(`\n${title}`);
  try { await fn(); } catch (e) { fail(title, e); }
}

// ── tests ─────────────────────────────────────────────────────────────────────

await section('1. Login — all seed accounts', async () => {
  for (const u of SEED_USERS) {
    try {
      const me = await login(BASE, u.username, PASSWORD);
      ok(`${u.username} (${u.role})`, `token=${me.id}`);
    } catch (e) {
      fail(`${u.username}`, e);
    }
  }
});

// Use 'thanh' (dev) for all skill tests — has tasks assigned
const me = await login(BASE, 'thanh', PASSWORD);

await section('2. dashboard skill', async () => {
  const result = await dashboard(api, me);
  if (!result.includes('Dashboard')) throw new Error('Missing Dashboard header');
  const lines = result.split('\n').length;
  ok('returned dashboard', `${lines} lines`);
  console.log('\n' + result.split('\n').slice(0, 12).join('\n'));
  if (result.length > 12) console.log('  ...');
});

await section('3. get_item skill', async () => {
  // Fetch items from project 1 to get a real item id
  const items = await api<{ id: number; title: string; tasks?: unknown[] }[]>('GET', '/projects/1/items');
  if (!items.length) throw new Error('No items in project 1');
  const first = items[0];
  ok(`found ${items.length} items`, `using item #${first.id}`);

  const detail = await getItem(api, { id: first.id });
  if (!detail.includes(`Item #${first.id}`)) throw new Error('Missing item header');
  ok(`get_item #${first.id}`, detail.split('\n')[0]);
});

await section('4. add_task skill', async () => {
  const items = await api<{ id: number }[]>('GET', '/projects/1/items');
  const itemId = items[0].id;

  const result = await addTask(api, {
    item_id: itemId,
    title: '[smoke] test task',
    due: new Date().toISOString().slice(0, 10),
    priority: 'TB',
  });
  if (!result.includes('Created task')) throw new Error('Missing confirmation');
  ok('add_task', result);

  // Extract created task id from result "Created task #N"
  const match = result.match(/#(\d+)/);
  if (match) {
    const taskId = parseInt(match[1], 10);

    await section('5. update_work skill — task lifecycle', async () => {
      for (const status of ['Doing', 'Done', 'Close'] as const) {
        const r = await updateWork(api, { id: taskId, kind: 'task', status });
        if (!r.includes(status)) throw new Error(`Status not reflected: ${r}`);
        ok(`task #${taskId} → ${status}`);
      }

      // Item status cycle
      const items2 = await api<{ id: number }[]>('GET', '/projects/1/items');
      const iid = items2[0].id;
      for (const status of ['Doing', 'Review', 'Done'] as const) {
        const r = await updateWork(api, { id: iid, kind: 'item', status });
        if (!r.includes(status)) throw new Error(`Status not reflected: ${r}`);
        ok(`item #${iid} → ${status}`);
      }
      // Reset item
      await updateWork(api, { id: iid, kind: 'item', status: 'Todo' });
      ok(`item #${iid} → Todo (reset)`);
    });
  }
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed > 0) process.exit(1);
