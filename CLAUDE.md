# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An MCP server (stdio transport) that exposes task-tracking from the `qlda-viot` backend as 4 tools to
Claude (`dashboard`, `update_work`, `get_item`, `add_task`). Same logic is also exposed as a standalone
CLI (`viot-tasktisk dashboard`, `get-item`, `add-task`, `update-task`, `update-item`) for use without an
MCP client. Ships as a single npm-installable binary; also self-registers into Claude Desktop, Claude
Code, VS Code, Antigravity, and Codex CLI config files.

## Commands

```bash
npm install
npm run dev          # run the MCP server directly via tsx, no build needed
npm run build        # bundle src/index.ts -> dist/index.js with tsup (single ESM file, shebang)
npm run typecheck    # tsc --noEmit
npm run test:smoke   # tsx tests/smoke.ts — integration test against a LIVE qlda-viot server
```

Run a single direct-CLI command during development without building:

```bash
npx tsx src/index.ts dashboard
npx tsx src/index.ts get-item 120
npx tsx src/index.ts add-task 120 "Write API tests" --due 2026-07-10 --priority Cao
```

**`tests/smoke.ts` is not a unit test** — it requires a running qlda-viot instance at
`http://localhost:3100` (override with `QLDA_URL`) and the seed accounts listed in `README.md`
(`cuong`/`tu`/`thanh`/`qanh`, password `123456`). It logs in as each seed user, then drives the full
dashboard → get_item → add_task → update_work (task + item lifecycle) path and prints pass/fail counts.
There is no other test suite.

### Critical: `dist/index.js` is committed

The GitHub install path (`npm install -g <tarball url>`) ships the prebuilt `dist/index.js` — there is
no build step at install time. **Whenever `src/` changes, run `npm run build` and commit the updated
`dist/index.js` in the same change**, or installs/updates will silently serve stale code.

### Critical: version string must stay in sync in three places

`viot-tasktisk update` and the startup update-check compare `package.json`'s `version` against the
remote `package.json` on GitHub, then download a release tarball whose filename embeds that version
(`viot-tasktisk-<version>.tgz`). When bumping the version, update all three or update-detection breaks:
- `package.json` → `"version"`
- `install.sh` → `REPO=".../viot-tasktisk-<version>.tgz"` (hardcoded, see comment at top of the file)
- the corresponding GitHub release must actually publish a tarball with that exact filename

## Architecture

**Module-level singleton auth state.** `src/api.ts` holds `token` / `currentUser` / `baseUrl` as module
variables (not a class), set by `login()` and read by `api()` and `getMe()`. Both the MCP server path
(`src/index.ts`) and every direct-CLI command (`src/cli.ts`) call `login()` once at startup before doing
anything else — there is no session persistence between process invocations.

**Skills are transport-agnostic.** `src/skills.ts` contains the actual behavior (`dashboard`,
`updateWork`, `addTask`, `getItem`) as plain functions taking an injected `api` function — they know
nothing about MCP or the CLI. `src/index.ts` wires them into `ListToolsRequestSchema` /
`CallToolRequestSchema` handlers; `src/cli.ts` wires the same functions into one-shot commands that
print to stdout and `process.exit()`. When changing tool behavior, edit `skills.ts`; when changing how
a tool is invoked/parsed, edit `index.ts` (MCP schema) or `cli.ts` (flag parsing) respectively.

**`src/index.ts` dispatches on `argv[2]` before starting the server.** `setup`, `configure`, `update`,
`dashboard`/`my-tasks`, `get-item`, `add-task`, `update-task`, `update-item`, and `--help` are all
handled as early-return subcommands (each lazily `import()`s its module). Only when none of those match
does it fall through to `loadConfig()` → `login()` → start the MCP `Server` on stdio. Add new
subcommands as another early-return branch here, and add the corresponding MCP tool definition +
`CallToolRequestSchema` case if it should also be callable from Claude.

**Config resolution (`src/config.ts`):** env vars (`QLDA_URL`/`QLDA_USERNAME`/`QLDA_PASSWORD`) always
win over the config file at `~/.config/viot-tasktisk/config.json` (mode `0600`). `installPrefix` in that
file (or `VIOT_INSTALL_PREFIX` env var during `setup`) records whether the install was global or
user-local (`~/.npm-global`), and is consumed later by `update.ts` (to `npm install` into the same
prefix) and `claude-config.ts` (to decide whether MCP configs need the full binary path or just
`viot-tasktisk`).

**Multi-target MCP registration (`src/claude-config.ts`).** Each target (`ClaudeTarget`) declares a
`configPath` and one of 4 `ConfigFormat`s: `mcp-servers` (plain JSON, Claude Desktop/Antigravity),
`vscode` (nested under `mcp.servers`), `toml` (hand-rolled regex-based TOML editing for Codex, no TOML
library dependency), or `claude-cli` (Claude Code — **not** a file edit; shells out to
`claude mcp remove` then `claude mcp add -s user`, since Claude Code's CLI does not read MCP servers
from `~/.claude/settings.json` despite that file existing). `resolveCommand()` decides between the bare
command name and the full `<prefix>/bin/viot-tasktisk` path — every target spawns the server as its own
subprocess, so a PATH change that only lives in `~/.bashrc`/`~/.zshrc` (user-local installs) is invisible
to them; only global installs can use the bare command name safely.

**Version injection.** `tsup.config.ts` reads `package.json`'s version at build time and injects it as
the `__PKG_VERSION__` global (see `define` in tsup config), which `update.ts` reads via
`declare const __PKG_VERSION__`. This is why version comparisons only work correctly in the built
`dist/index.js`, not when running `npm run dev` directly (falls back to `'dev'`).

**Update flow (`src/update.ts`):** `startUpdateCheck()` fires a background, non-blocking fetch of the
remote `package.json` on server startup; if a newer version exists it writes to stderr and the module
state is later surfaced as a banner inside the `dashboard` skill's output (`getUpdateAvailable()`).
`runUpdate()` (the `update` subcommand) does the same version check synchronously, then re-runs
`npm install -g [--prefix <installPrefix>] <tarball-url>` using whatever prefix was recorded at install
time.
