#!/usr/bin/env bash
set -e

REPO="github:Iot-Viet-Solution/viot-tasktisk"
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

detect_profile() {
  if [ -n "${ZDOTDIR:-}" ] || [ -f "$HOME/.zshrc" ]; then
    echo "$HOME/.zshrc"
  elif [ -f "$HOME/.bashrc" ]; then
    echo "$HOME/.bashrc"
  else
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
read -rp "Choose [1/2, default 1]: " choice

echo ""

case "$choice" in
  2)
    echo "Installing to $USER_PREFIX ..."
    npm install -g --prefix "$USER_PREFIX" "$REPO"

    BIN_DIR="$USER_PREFIX/bin"

    if ! in_path "$BIN_DIR"; then
      PROFILE=$(detect_profile)
      EXPORT_LINE="export PATH=\"$BIN_DIR:\$PATH\""

      echo ""
      printf "$(bold 'PATH setup needed.')\n"
      echo "Add this line to your shell profile:"
      echo ""
      printf "  $(green "$EXPORT_LINE")\n"
      echo ""

      read -rp "Add it to $PROFILE automatically? [Y/n]: " auto
      if [[ "${auto:-Y}" =~ ^[Yy]$ ]]; then
        echo "" >> "$PROFILE"
        echo "# viot-tasktisk" >> "$PROFILE"
        echo "$EXPORT_LINE" >> "$PROFILE"
        printf "$(green '✓') Added to %s\n" "$PROFILE"
        echo "  Run: source $PROFILE"
        # Also export for the current shell session
        export PATH="$BIN_DIR:$PATH"
      else
        echo "Skipped — add it manually then restart your terminal."
        export PATH="$BIN_DIR:$PATH"
      fi
    fi
    ;;
  *)
    echo "Installing globally ..."
    npm install -g "$REPO"
    ;;
esac

echo ""
printf "$(green '✓') Installed. Running setup...\n\n"
viot-tasktisk setup
