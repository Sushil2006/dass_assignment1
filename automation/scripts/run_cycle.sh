#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/common.sh"

CYCLE_NUM=""
ENV_FILE="$ENV_FILE_DEFAULT"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cycle)
      CYCLE_NUM="$2"
      shift 2
      ;;
    --env)
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      log ERROR "Unknown argument: $1"
      exit 1
      ;;
  esac
done

load_env "$ENV_FILE"

if [[ -z "$CYCLE_NUM" ]]; then
  CYCLE_NUM="manual-$(date +%Y%m%d-%H%M%S)"
fi

CYCLE_DIR="$ARTIFACTS_DIR/cycle-$CYCLE_NUM"
mkdir -p "$CYCLE_DIR"

log INFO "=== Cycle $CYCLE_NUM started ==="
log INFO "Artifact directory: $CYCLE_DIR"

cleanup() {
  "$AUTOMATION_DIR/scripts/stop_services.sh" || true
}
trap cleanup EXIT

start_ts="$(date +%s)"
status="pass"

"$AUTOMATION_DIR/scripts/reset_state.sh" "$ENV_FILE" >"$CYCLE_DIR/reset.log" 2>&1
"$AUTOMATION_DIR/scripts/start_services.sh" "$ENV_FILE" "$CYCLE_DIR"
"$AUTOMATION_DIR/scripts/run_codex_explorer.sh" "$ENV_FILE" "$CYCLE_DIR" || true

if "$AUTOMATION_DIR/scripts/run_playwright_suite.sh" "$ENV_FILE" "$CYCLE_DIR"; then
  status="pass"
else
  status="failed-initial"

  max_attempts="$CODEX_FIX_ATTEMPTS"
  attempt=1
  while (( attempt <= max_attempts )); do
    "$AUTOMATION_DIR/scripts/run_codex_fix.sh" "$ENV_FILE" "$CYCLE_DIR" "$attempt" || true

    if "$AUTOMATION_DIR/scripts/run_playwright_suite.sh" "$ENV_FILE" "$CYCLE_DIR"; then
      status="pass-after-fix"
      break
    fi

    attempt=$((attempt + 1))
  done

  if [[ "$status" != "pass-after-fix" ]]; then
    status="failed-after-fixes"
  fi
fi

end_ts="$(date +%s)"
duration=$((end_ts - start_ts))

cat > "$CYCLE_DIR/summary.txt" <<SUMMARY
cycle=$CYCLE_NUM
status=$status
duration_seconds=$duration
date=$(date '+%Y-%m-%d %H:%M:%S')
SUMMARY

log INFO "Cycle $CYCLE_NUM finished with status=$status in ${duration}s"

if [[ "$status" == "failed-after-fixes" ]]; then
  exit 1
fi
