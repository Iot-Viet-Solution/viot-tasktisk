#!/usr/bin/env bash
set -e

REPO="https://github.com/Iot-Viet-Solution/viot-tasktisk/releases/latest/download/viot-tasktisk-1.0.0.tgz"
USER_PREFIX="$HOME/.npm-global"

# ── helpers ──────────────────────────────────────────────────────────────────

bold()  { printf '\033[1m%s\033[0m' "$*"; }
green() { printf '\033[32m%s\033[0m' "$*"; }
dim()   { printf '\033[2m%s\033[0m' "$*"; }

require_npm() {
  if ! command -v npm &>/dev/null; then
    echo "Error: npm is not installed. Install Node.js ≥ 20 from https://nodejs.org"
    exit 1
  fi
  local ver
  ver=$(node -e 'process.exit(parseInt(process.versions.node)<20?1:0)' 2>/dev/null && node --version || true)
  if ! node -e 'process.exit(parseInt(process.versions.node)<20?1:0)' 2>/dev/null; then
    echo "Error: Node.js 20+ is required (found $(node --version 2>/dev/null || echo 'none'))"
    exit 1
  fi
}

detect_profiles() {
  if [ -n "${ZDOTDIR:-}" ] || [ -f "$HOME/.zshrc" ]; then
    # .zshrc covers interactive shells, .zprofile covers login shells (e.g. SSH)
    echo "$HOME/.zshrc"
    echo "$HOME/.zprofile"
  else
    # .bashrc covers interactive non-login shells (local terminals); .profile
    # covers login shells (SSH sessions), which many distros do NOT source
    # .bashrc from — without it, a fresh SSH login won't see the PATH change.
    echo "$HOME/.bashrc"
    echo "$HOME/.profile"
  fi
}

in_path() {
  echo ":$PATH:" | grep -q ":$1:"
}

# ── main ─────────────────────────────────────────────────────────────────────

require_npm

echo ""
printf "$(bold 'viot-tasktisk') — install\n\n"
echo "  $(bold '[1]') Global   — all users on this machine $(dim '(may need sudo)')"
echo "  $(bold '[2]') User     — current user only, no sudo needed"
echo ""
if [ -r /dev/tty ]; then
  read -rp "Choose [1/2, default 1]: " choice < /dev/tty
else
  echo "No interactive terminal detected (e.g. running via 'curl | bash' in a non-TTY context)."
  echo "Defaulting to User install — no sudo needed."
  choice=2
fi

echo ""

# Collect QLDA credentials upfront too, so the whole thing runs unattended
# after this point instead of stopping mid-install to ask again.
QLDA_URL_INPUT=""
QLDA_USERNAME_INPUT=""
QLDA_PASSWORD_INPUT=""

if [ -r /dev/tty ]; then
  printf "$(bold 'QLDA credentials') $(dim '(used to connect to the task server)')\n\n"
  read -rp "QLDA API URL [http://localhost:3100]: " QLDA_URL_INPUT < /dev/tty
  read -rp "Username: " QLDA_USERNAME_INPUT < /dev/tty
  read -rsp "Password: " QLDA_PASSWORD_INPUT < /dev/tty
  echo ""
  echo ""
fi

case "$choice" in
  2)
    echo "Installing to $USER_PREFIX ..."
    npm install -g --prefix "$USER_PREFIX" "$REPO"

    BIN_DIR="$USER_PREFIX/bin"

    if ! in_path "$BIN_DIR"; then
      EXPORT_LINE="export PATH=\"$BIN_DIR:\$PATH\""

      echo ""
      printf "$(bold 'PATH setup needed.')\n"
      echo "Add this line to your shell profile:"
      echo ""
      printf "  $(green "$EXPORT_LINE")\n"
      echo ""

      if [ -r /dev/tty ]; then
        read -rp "Add it automatically to your shell profile(s)? [Y/n]: " auto < /dev/tty
      else
        auto="Y"
      fi
      if [[ "${auto:-Y}" =~ ^[Yy]$ ]]; then
        while IFS= read -r PROFILE; do
          touch "$PROFILE"
          if ! grep -qF "$EXPORT_LINE" "$PROFILE" 2>/dev/null; then
            echo "" >> "$PROFILE"
            echo "# viot-tasktisk" >> "$PROFILE"
            echo "$EXPORT_LINE" >> "$PROFILE"
            printf "$(green '✓') Added to %s\n" "$PROFILE"
          fi
        done <<< "$(detect_profiles)"
        echo "  Open a new terminal (or new SSH session) to pick it up."
        export PATH="$BIN_DIR:$PATH"
      else
        echo "Skipped — add it manually then restart your terminal."
        export PATH="$BIN_DIR:$PATH"
      fi
    fi
    ;;
  *)
    echo "Installing globally ..."
    if ! npm install -g "$REPO"; then
      echo ""
      echo "Global install failed — likely no write access to npm's global directory (needs sudo)."
      echo "Re-run this script and choose [2] User install instead, which needs no sudo:"
      echo ""
      echo "  curl -fsSL https://raw.githubusercontent.com/Iot-Viet-Solution/viot-tasktisk/main/install.sh | bash"
      echo ""
      exit 1
    fi
    ;;
esac

echo ""
printf "$(green '✓') Installed. Running setup...\n\n"

# Pass the install prefix so setup can save it for future `viot-tasktisk update` calls.
# Redirect stdin from the real terminal — this script's own stdin may be an
# exhausted `curl | bash` pipe, which would otherwise starve setup's prompts.
SETUP_STDIN=/dev/stdin
if [ -r /dev/tty ]; then
  SETUP_STDIN=/dev/tty
fi

if [ -n "$QLDA_USERNAME_INPUT" ] && [ -n "$QLDA_PASSWORD_INPUT" ]; then
  export QLDA_URL="${QLDA_URL_INPUT:-http://localhost:3100}"
  export QLDA_USERNAME="$QLDA_USERNAME_INPUT"
  export QLDA_PASSWORD="$QLDA_PASSWORD_INPUT"
fi

if [ "$choice" = "2" ]; then
  VIOT_INSTALL_PREFIX="$USER_PREFIX" viot-tasktisk setup < "$SETUP_STDIN"
else
  viot-tasktisk setup < "$SETUP_STDIN"
fi
