# viot-tasktisk

MCP server for [qlda-viot](https://github.com/Iot-Viet-Solution/qlda-viot) task tracking.
Exposes 4 high-level skills to Claude — no raw API fiddling needed.

| Tool | What it does |
|---|---|
| `dashboard` | My tasks grouped by urgency + weekly priorities (one call overview) |
| `update_work` | Set status / due / priority on a task or item |
| `get_item` | Full item detail with all child tasks |
| `add_task` | Create a task under an item |

---

## Install

**Requires Node.js ≥ 20.**

### macOS / Linux

Run the installer. It asks a few questions upfront — global vs. user install, then
your QLDA credentials — so the rest (npm install + setup wizard) runs unattended:

```bash
curl -fsSL https://raw.githubusercontent.com/Iot-Viet-Solution/viot-tasktisk/main/install.sh | bash
```

Upfront prompts:
- **Global or User install**
- **QLDA API URL** (default `http://localhost:3100`)
- **Username**
- **Password** (hidden input)

Config is saved to `~/.config/viot-tasktisk/config.json` (mode 0600).
The wizard prints the exact snippet to paste into Claude Desktop when done.

### Install options explained

| | Global | User |
|---|---|---|
| Who can use it | Everyone on the machine | Current user only |
| Needs sudo | Sometimes (depends on npm setup) | Never |
| Install prefix | system npm global | `~/.npm-global` |
| PATH change needed | No | Yes (installer offers to do it) |

### Windows

```powershell
npm install -g https://github.com/Iot-Viet-Solution/viot-tasktisk/releases/latest/download/viot-tasktisk-1.0.1.tgz
viot-tasktisk setup
```

### Manual install (without the script)

```bash
# Global
npm install -g https://github.com/Iot-Viet-Solution/viot-tasktisk/releases/latest/download/viot-tasktisk-1.0.1.tgz
viot-tasktisk setup

# User-local
npm install -g --prefix ~/.npm-global https://github.com/Iot-Viet-Solution/viot-tasktisk/releases/latest/download/viot-tasktisk-1.0.1.tgz
export PATH="$HOME/.npm-global/bin:$PATH"   # add to ~/.zshrc or ~/.bashrc
viot-tasktisk setup
```

---

## Claude integration

`viot-tasktisk setup` offers to auto-configure both Claude products at the end of the wizard.
To re-run just the config step (without re-entering credentials):

```bash
viot-tasktisk configure
```

This registers `viot-tasks` as a stdio MCP server for each product:

| Product | How it's configured | Config location |
|---|---|---|
| Claude Desktop (macOS) | JSON `mcpServers` written directly | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | JSON `mcpServers` written directly | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Desktop (Linux) | JSON `mcpServers` written directly | `~/.config/Claude/claude_desktop_config.json` |
| Claude Code (CLI) | `claude mcp add -s user viot-tasks -- <command>` | `~/.claude.json` (user scope) |
| VS Code | JSON `mcp.servers` written directly | platform user `settings.json` |
| Antigravity CLI (Google) | JSON `mcpServers` written directly | `~/.gemini/config/mcp_config.json` |
| Codex CLI (OpenAI) | TOML `[mcp_servers.viot-tasks]` written directly | `~/.codex/config.toml` |

Claude Code is the one exception: its CLI doesn't read MCP servers from `~/.claude/settings.json`
(despite that file existing and looking plausible) — the *only* supported way to register one is
the `claude mcp` subcommand, which stores it in `~/.claude.json`. `configure` shells out to
`claude mcp remove` (ignoring "not found") then `claude mcp add`, so re-running it updates the
command instead of erroring on a duplicate. This requires the `claude` CLI to be on PATH.

Restart Claude Desktop / reload Claude Code after configuring.

> **User-local install**: every target here launches the server as its own subprocess rather
> than through your interactive shell, so none of them see a PATH change that only lives in
> `~/.bashrc` / `~/.zshrc`. `configure` therefore always uses the full binary path
> (`~/.npm-global/bin/viot-tasktisk`) for a user-local install, for every target — not just
> Claude Desktop.

---

## Usage

### From Claude

Once configured (see above), just ask in plain language — Claude picks the right tool:

- *"What's on my dashboard today?"*
- *"Mark task 482 as Done"*
- *"Show me item 120 with all its tasks"*
- *"Add a task to item 120: write API tests, due 2026-07-10, priority Cao"*

### Direct CLI (no Claude needed)

Every tool is also a standalone terminal command — handy for scripts or a quick check:

```bash
viot-tasktisk dashboard                       # your tasks + weekly priorities
viot-tasktisk my-tasks                        # alias for dashboard
viot-tasktisk get-item <item_id>               # full item detail + child tasks
viot-tasktisk add-task <item_id> <title> [options]
  --due YYYY-MM-DD          # due date
  --priority TB|Cao|Thấp    # priority
  --assignee <user_id>      # assign to user
  --descr <text>            # description
viot-tasktisk update-task <task_id> <status>   # Plan · Todo · Doing · Done · Close · "Need help"
viot-tasktisk update-item <item_id> <status>   # Todo · Doing · Review · Done · Cancelled
viot-tasktisk --help                           # full command reference
```

Examples:

```bash
viot-tasktisk get-item 120
viot-tasktisk add-task 120 "Write API tests" --due 2026-07-10 --priority Cao
viot-tasktisk update-task 482 Done
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `command not found: viot-tasktisk` | User-local install only: open a new terminal, or run `source ~/.bashrc` (or `~/.zshrc`) so the PATH change takes effect. |
| `No config found. Run \`viot-tasktisk setup\`...` | Credentials haven't been saved yet — run `viot-tasktisk setup`, or set `QLDA_URL` / `QLDA_USERNAME` / `QLDA_PASSWORD` env vars. |
| `Login failed: ...` | Wrong username/password, or the QLDA API URL is unreachable — re-run `viot-tasktisk setup` to fix either. Check the URL is reachable with `curl -I <url>`. |
| Tools don't show up in Claude Desktop / Claude Code | Config was written but the client hasn't reloaded — fully restart Claude Desktop, or start a new Claude Code session (MCP servers are only loaded at session start). |
| `claude mcp list` shows `viot-tasks` as "Failed to connect" | Almost always a stale short command name (`viot-tasktisk` instead of the full path) from a user-local install predating this fix — re-run `viot-tasktisk configure` so it re-registers with the absolute path via `claude mcp add`. |
| `configure` errors on the Claude Code step | The `claude` CLI isn't on PATH in the shell running `configure` — install/open Claude Code's CLI first, or configure that target manually with `claude mcp add -s user viot-tasks -- <full path to viot-tasktisk>`. |

---

## Override via env vars

Env vars take priority over the config file — useful for CI or Docker:

```bash
QLDA_URL=http://your-server:3100 \
QLDA_USERNAME=thanh \
QLDA_PASSWORD=secret \
viot-tasktisk
```

---

## Update

```bash
viot-tasktisk update
```

Pulls the latest version from GitHub and reinstalls using the same prefix (global or user-local)
that was used when you first installed. Prints a reminder to restart Claude Desktop.

## Re-configure

```bash
viot-tasktisk setup
```

---

## Development

```bash
git clone https://github.com/Iot-Viet-Solution/viot-tasktisk
cd viot-tasktisk
npm install
npm run dev          # run directly with tsx (no build needed)
npm run build        # rebuild dist/index.js
npm run typecheck    # type check only
```

The prebuilt `dist/index.js` is committed so the GitHub install needs no build step.
When you change source, run `npm run build` and commit `dist/index.js`.

---

## Seed accounts (for testing against local qlda-viot)

| Username | Role | Password |
|---|---|---|
| `cuong` | admin | `123456` |
| `tu` | tuvan | `123456` |
| `thanh` | dev | `123456` |
| `qanh` | qa | `123456` |

Default URL: `http://localhost:3100`
