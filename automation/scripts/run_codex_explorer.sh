#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/common.sh"
ENV_FILE="${1:-$ENV_FILE_DEFAULT}"
CYCLE_DIR="${2:-$ARTIFACTS_DIR/manual}"
if [[ "$CYCLE_DIR" != /* ]]; then
  CYCLE_DIR="$ROOT_DIR/$CYCLE_DIR"
fi
load_env "$ENV_FILE"

if ! is_true "$RUN_CODEX_EXPLORER"; then
  log INFO "RUN_CODEX_EXPLORER=false, skipping exploratory Codex run"
  exit 0
fi

PROMPT_FILE="$AUTOMATION_DIR/prompts/explorer_prompt.md"
OUTPUT_FILE="$CYCLE_DIR/codex-explorer-last-message.txt"
LOG_FILE="$CYCLE_DIR/codex-explorer.log"

log INFO "Starting Codex exploratory browser run (Playwright MCP)"

if timeout "${CODEX_TIMEOUT_MINUTES}m" \
  codex exec \
    -C "$ROOT_DIR" \
    -m "$CODEX_MODEL" \
    -c "model_reasoning_effort=\"$CODEX_REASONING_EFFORT\"" \
    -s danger-full-access \
    -o "$OUTPUT_FILE" \
    "$(cat "$PROMPT_FILE")" >"$LOG_FILE" 2>&1; then
  log INFO "Codex exploratory run completed"
else
  log WARN "Codex exploratory run timed out or failed; continuing cycle"
fi
