#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/common.sh"
ENV_FILE="${1:-$ENV_FILE_DEFAULT}"
CYCLE_DIR="${2:-$ARTIFACTS_DIR/manual}"
ATTEMPT="${3:-1}"
if [[ "$CYCLE_DIR" != /* ]]; then
  CYCLE_DIR="$ROOT_DIR/$CYCLE_DIR"
fi
load_env "$ENV_FILE"

if ! is_true "$RUN_CODEX_ON_FAILURE"; then
  log INFO "RUN_CODEX_ON_FAILURE=false, skipping codex fix"
  exit 0
fi

PROMPT_FILE="$AUTOMATION_DIR/prompts/fix_prompt.md"
OUTPUT_FILE="$CYCLE_DIR/codex-fix-${ATTEMPT}-last-message.txt"
LOG_FILE="$CYCLE_DIR/codex-fix-${ATTEMPT}.log"

log INFO "Starting Codex fix attempt $ATTEMPT"

if timeout "${CODEX_TIMEOUT_MINUTES}m" \
  codex exec \
    -C "$ROOT_DIR" \
    -m "$CODEX_MODEL" \
    -c "model_reasoning_effort=\"$CODEX_REASONING_EFFORT\"" \
    -s workspace-write \
    -o "$OUTPUT_FILE" \
    "$(
      cat "$PROMPT_FILE"
      echo
      echo "Context files:"
      echo "- Playwright log: $CYCLE_DIR/playwright/stdout.log"
      echo "- Explorer log: $CYCLE_DIR/codex-explorer.log"
      echo "- App logs: $CYCLE_DIR/backend.log and $CYCLE_DIR/frontend.log"
    )" >"$LOG_FILE" 2>&1; then
  log INFO "Codex fix attempt $ATTEMPT completed"
  exit 0
fi

log WARN "Codex fix attempt $ATTEMPT timed out or failed"
exit 1
