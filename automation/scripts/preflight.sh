#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/common.sh"
load_env "${1:-$ENV_FILE_DEFAULT}"

log INFO "Running preflight checks"
require_cmd node
require_cmd npm
require_cmd curl
require_cmd codex

if ! command -v mongosh >/dev/null 2>&1; then
  log WARN "mongosh not found. This setup uses Node MongoDB driver for resets, so mongosh is optional."
fi

log INFO "Installing backend dependencies"
npm --prefix "$ROOT_DIR/backend" install

log INFO "Installing frontend dependencies"
npm --prefix "$ROOT_DIR/frontend" install

log INFO "Installing automation Playwright dependencies"
npm --prefix "$AUTOMATION_DIR/playwright" install

log INFO "Installing Playwright Chromium"
npm --prefix "$AUTOMATION_DIR/playwright" exec playwright install chromium

log INFO "Preflight completed"
