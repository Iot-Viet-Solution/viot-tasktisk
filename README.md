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

## Install (macOS / Linux)

**Requires Node.js ≥ 20.**

Run the installer — it asks whether to install globally (all users) or for the current user only,
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

### Manual install (without the script)

```bash
# Global
npm install -g github:Iot-Viet-Solution/viot-tasktisk
viot-tasktisk setup

# User-local
npm install -g --prefix ~/.npm-global github:Iot-Viet-Solution/viot-tasktisk
export PATH="$HOME/.npm-global/bin:$PATH"   # add to ~/.zshrc or ~/.bashrc
viot-tasktisk setup
```

### Windows

```powershell
npm install -g github:Iot-Viet-Solution/viot-tasktisk
viot-tasktisk setup
```

---

## Claude Desktop config

After running setup, add this to your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "viot-tasks": {
      "command": "viot-tasktisk"
    }
  }
}
```

Restart Claude Desktop. The server auto-logs in on start using the saved config.

> **User-local install on macOS/Linux**: if Claude Desktop doesn't pick up your PATH,
> use the full binary path instead:
> ```json
> { "command": "/home/you/.npm-global/bin/viot-tasktisk" }
> ```

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
