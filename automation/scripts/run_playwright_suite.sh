#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/common.sh"
ENV_FILE="${1:-$ENV_FILE_DEFAULT}"
CYCLE_DIR="${2:-$ARTIFACTS_DIR/manual}"
if [[ "$CYCLE_DIR" != /* ]]; then
  CYCLE_DIR="$ROOT_DIR/$CYCLE_DIR"
fi
load_env "$ENV_FILE"

mkdir -p "$CYCLE_DIR/playwright"

log INFO "Running Playwright suite"
project_args=()
for project in $PW_PROJECTS; do
  project_args+=(--project "$project")
done

test_targets=()
for target in $PW_TEST_TARGETS; do
  test_targets+=("$target")
done

(
  cd "$AUTOMATION_DIR/playwright"
  BASE_URL="http://127.0.0.1:${FRONTEND_PORT}" \
  API_URL="http://127.0.0.1:${BACKEND_PORT}" \
  TEST_ADMIN_EMAIL="$ADMIN_EMAIL" \
  TEST_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  TEST_PARTICIPANT_EMAIL="$TEST_PARTICIPANT_EMAIL" \
  TEST_PARTICIPANT_PASSWORD="$TEST_PARTICIPANT_PASSWORD" \
  TEST_ORGANIZER_EMAIL="$TEST_ORGANIZER_EMAIL" \
  TEST_ORGANIZER_PASSWORD="$TEST_ORGANIZER_PASSWORD" \
  PW_RETRIES="$PW_RETRIES" \
  CI=1 \
  npx playwright test \
    "${test_targets[@]}" \
    --max-failures "$PW_MAX_FAILURES" \
    "${project_args[@]}" \
    --workers "$PW_WORKERS" \
    --reporter=line \
    --output "$CYCLE_DIR/playwright/test-results"
) >"$CYCLE_DIR/playwright/stdout.log" 2>&1 || {
  log WARN "Playwright suite failed"
  exit 1
}

log INFO "Playwright suite passed"
