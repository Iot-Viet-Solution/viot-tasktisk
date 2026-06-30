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

Run the installer — it asks whether to install globally or for the current user only,
then launches the setup wizard:

```bash
curl -fsSL https://raw.githubusercontent.com/Iot-Viet-Solution/viot-tasktisk/main/install.sh | bash
```

The wizard prompts for:
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
npm install -g https://github.com/Iot-Viet-Solution/viot-tasktisk/releases/latest/download/viot-tasktisk-1.0.0.tgz
viot-tasktisk setup
```

### Manual install (without the script)

```bash
# Global
npm install -g https://github.com/Iot-Viet-Solution/viot-tasktisk/releases/latest/download/viot-tasktisk-1.0.0.tgz
viot-tasktisk setup

# User-local
npm install -g --prefix ~/.npm-global https://github.com/Iot-Viet-Solution/viot-tasktisk/releases/latest/download/viot-tasktisk-1.0.0.tgz
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

This writes `viot-tasks` into `mcpServers` in the appropriate config file for each product:

| Product | Config file | Format |
|---|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` | JSON `mcpServers` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` | JSON `mcpServers` |
| Claude Desktop (Linux) | `~/.config/Claude/claude_desktop_config.json` | JSON `mcpServers` |
| Claude Code (CLI) | `~/.claude/settings.json` | JSON `mcpServers` |
| VS Code | platform user `settings.json` | JSON `mcp.servers` |
| Antigravity CLI (Google) | `~/.gemini/config/mcp_config.json` | JSON `mcpServers` |
| Codex CLI (OpenAI) | `~/.codex/config.toml` | TOML `[mcp_servers.viot-tasks]` |

Restart Claude Desktop / reload Claude Code after configuring.

> **User-local install**: `configure` automatically uses the full binary path
> (`~/.npm-global/bin/viot-tasktisk`) for Claude Desktop, which doesn't inherit your shell
> PATH. Claude Code runs in the terminal so it always uses the short name.

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
