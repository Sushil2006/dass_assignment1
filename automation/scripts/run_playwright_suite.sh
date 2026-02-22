#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/common.sh"
ENV_FILE="${1:-$ENV_FILE_DEFAULT}"
CYCLE_DIR="${2:-$ARTIFACTS_DIR/manual}"
if [[ "$CYCLE_DIR" != /* ]]; then
  CYCLE_DIR="$ROOT_DIR/$CYCLE_DIR"
fi
load_env "$ENV_FILE"

if [[ -n "${PW_TEST_TARGETS_OVERRIDE:-}" ]]; then
  PW_TEST_TARGETS="$PW_TEST_TARGETS_OVERRIDE"
fi

mkdir -p "$CYCLE_DIR/playwright"

log INFO "Running Playwright suite"
project_args=()
for project in $PW_PROJECTS; do
  project_args+=(--project "$project")
done

test_targets=()

resolve_targets() {
  local mode="$1"

  if [[ "$mode" == "auto-all" ]]; then
    while IFS= read -r file; do
      [[ -z "$file" ]] && continue
      test_targets+=("$file")
    done < <(
      cd "$AUTOMATION_DIR/playwright" &&
        find tests -type f -name '*.spec.js' | sort
    )
    return
  fi

  if [[ "$mode" == "auto-smoke" ]]; then
    while IFS= read -r file; do
      [[ -z "$file" ]] && continue
      test_targets+=("$file")
    done < <(
      cd "$AUTOMATION_DIR/playwright" &&
        find tests -type f -name '*.smoke.spec.js' | sort
    )

    if (( ${#test_targets[@]} == 0 )); then
      test_targets+=("tests/auth-rbac.spec.js" "tests/participant-flows.spec.js")
    fi
    return
  fi

  for target in $mode; do
    test_targets+=("$target")
  done
}

resolve_targets "$PW_TEST_TARGETS"

if (( ${#test_targets[@]} == 0 )); then
  log ERROR "No Playwright tests selected. Check PW_TEST_TARGETS."
  exit 1
fi

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
