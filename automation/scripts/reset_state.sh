#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/common.sh"
ENV_FILE="${1:-$ENV_FILE_DEFAULT}"
load_env "$ENV_FILE"

log INFO "Resetting DB and deterministic seed"
NODE_PATH="$ROOT_DIR/backend/node_modules" \
  npm --prefix "$ROOT_DIR/backend" exec tsx "$AUTOMATION_DIR/scripts/reset_db.ts" "$ENV_FILE"

rm -rf "$ROOT_DIR/backend/uploads-overnight"
mkdir -p "$ROOT_DIR/backend/uploads-overnight"

log INFO "State reset complete"
