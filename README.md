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

```bash
npm install -g github:Iot-Viet-Solution/viot-tasktisk
```

Then run the setup wizard (prompts for server URL, username, password):

```bash
viot-tasktisk setup
```

Config is saved to `~/.config/viot-tasktisk/config.json` (mode 0600).
The wizard prints the exact snippet to add to Claude Desktop when done.

---

## Claude Desktop config

After running setup, add this to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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
viot-tasktisk setup   # overwrites existing config
```

---

## Development

```bash
git clone https://github.com/Iot-Viet-Solution/viot-tasktisk
cd viot-tasktisk
npm install
npm run dev          # run with tsx (no build needed)
npm run build        # rebuild dist/
npm run typecheck    # type check only
```

The prebuilt `dist/index.js` is committed so users get it directly from the GitHub install.

---

## Seed accounts (for testing against local qlda-viot)

| Username | Role |
|---|---|
| `cuong` | admin |
| `tu` | tuvan |
| `thanh` | dev |
| `qanh` | qa |

Default password: `123456`  
Default URL: `http://localhost:3100`
