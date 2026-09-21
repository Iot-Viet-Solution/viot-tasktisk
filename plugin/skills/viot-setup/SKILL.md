---
name: viot-setup
description: Diagnose or fix the viot-tasktisk connection to qlda-viot — login failures, "No config found", tools missing or erroring. Use when viot-tasktisk tools fail or the user is setting it up.
---

# viot-tasktisk setup / troubleshooting

The plugin starts the `viot-tasktisk` binary, which must be installed separately. Credentials come from the plugin's own settings (URL, username, password — prompted when the plugin is enabled, password kept in the system keychain); change them from the `/plugin` menu (viot-tasktisk → configure). Env vars or `~/.config/viot-tasktisk/config.json` are only needed for standalone use of the binary.

1. **Installed?** Run `viot-tasktisk whoami` in a shell (it also confirms the login works). If not found, install (needs Node ≥ 20):
   `npm install -g https://github.com/Iot-Viet-Solution/viot-tasktisk/releases/latest/download/viot-tasktisk-<version>.tgz` (see the latest release for the exact filename), or run the repo's `install.sh`.
2. **Standalone / CLI use:** `viot-tasktisk setup` asks for the QLDA URL, username and password and stores them in `~/.config/viot-tasktisk/config.json`. Alternatively set `QLDA_URL`, `QLDA_USERNAME`, `QLDA_PASSWORD` in the environment.
3. **Still broken?** `viot-tasktisk doctor` checks config, login and connectivity and reads the local log. Fix what it reports, then restart Claude Code so the MCP server reconnects.
4. **Update:** `viot-tasktisk update`.

Never ask the user to paste their password into the chat — have them run `viot-tasktisk setup` themselves (in Claude Code: type `! viot-tasktisk setup`).

If `viot-tasktisk setup` also registered a standalone MCP server, the plugin's server will duplicate its tools; keep one (`claude mcp remove` the standalone one).
