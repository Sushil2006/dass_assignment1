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

effective_test_targets="$PW_TEST_TARGETS"
sweep_mode="smoke"
if [[ "$CYCLE_NUM" =~ ^[0-9]+$ ]] && [[ "$FULL_SWEEP_EVERY_CYCLES" =~ ^[0-9]+$ ]] && (( FULL_SWEEP_EVERY_CYCLES > 0 )); then
  if (( CYCLE_NUM % FULL_SWEEP_EVERY_CYCLES == 0 )); then
    effective_test_targets="$PW_FULL_TEST_TARGETS"
    sweep_mode="full"
  fi
fi

log INFO "=== Cycle $CYCLE_NUM started ==="
log INFO "Artifact directory: $CYCLE_DIR"

cleanup() {
  "$AUTOMATION_DIR/scripts/stop_services.sh" || true
}
trap cleanup EXIT

snapshot_code_state() {
  local output_file="$1"

  (
    cd "$ROOT_DIR"
    find . \
      \( -path './.git' \
      -o -path './node_modules' \
      -o -path './backend/node_modules' \
      -o -path './frontend/node_modules' \
      -o -path './automation/playwright/node_modules' \
      -o -path './automation/artifacts' \
      -o -path './automation/reports' \
      -o -path './automation/runtime' \
      -o -path './backend/dist' \
      -o -path './frontend/dist' \
      \) -prune -o \
      -type f \
      \( -name '*.ts' \
      -o -name '*.tsx' \
      -o -name '*.js' \
      -o -name '*.jsx' \
      -o -name '*.json' \
      -o -name '*.md' \
      -o -name '*.sh' \
      -o -name '*.yml' \
      -o -name '*.yaml' \
      -o -name '.env' \
      -o -name '.env.*' \
      \) \
      -print0 |
      sort -z |
      while IFS= read -r -d '' file; do
        local hash
        hash="$(sha256sum "$file" | awk '{print $1}')"
        printf '%s\t%s\n' "$file" "$hash"
      done
  ) > "$output_file"
}

collect_code_changes() {
  local start_file="$1"
  local end_file="$2"
  local output_file="$3"

  awk -F '\t' '
    NR==FNR { start[$1]=$2; next }
    {
      end[$1]=$2;
      if (!($1 in start) || start[$1] != $2) {
        print $1;
      }
    }
    END {
      for (path in start) {
        if (!(path in end)) {
          print path " (deleted)";
        }
      }
    }
  ' "$start_file" "$end_file" | sort -u > "$output_file"
}

append_running_report() {
  if [[ -z "${RUNNING_REPORT_FILE:-}" ]]; then
    return
  fi

  local report_file="$RUNNING_REPORT_FILE"
  local changes_count="0"
  if [[ -s "$CYCLE_DIR/code-changes.txt" ]]; then
    changes_count="$(wc -l < "$CYCLE_DIR/code-changes.txt" | tr -d ' ')"
  fi

  {
    echo "### Cycle $CYCLE_NUM"
    echo "- Status: $status"
    echo "- Sweep mode: $sweep_mode"
    echo "- Duration: ${duration}s"
    echo "- Playwright runs in cycle: $test_runs"
    printf -- "- Tests configured: \`%s\`\n" "$effective_test_targets"
    printf -- "- Projects: \`%s\`\n" "$PW_PROJECTS"
    printf -- "- Codex explorer enabled: \`%s\`\n" "$RUN_CODEX_EXPLORER"
    printf -- "- Codex fix enabled: \`%s\`\n" "$RUN_CODEX_ON_FAILURE"
    echo "- Codex fix attempts used: $fix_attempts_used/$CODEX_FIX_ATTEMPTS"
    echo "- Code files changed in cycle: $changes_count"
    if [[ -s "$CYCLE_DIR/code-changes.txt" ]]; then
      while IFS= read -r file; do
        printf -- "- Changed: \`%s\`\n" "$file"
      done < "$CYCLE_DIR/code-changes.txt"
    else
      echo "- Changed: none"
    fi
    printf -- "- Artifacts: \`%s\`\n" "$CYCLE_DIR"
    echo
  } >> "$report_file"
}

run_tests() {
  test_runs=$((test_runs + 1))
  PW_TEST_TARGETS_OVERRIDE="$effective_test_targets" \
    "$AUTOMATION_DIR/scripts/run_playwright_suite.sh" "$ENV_FILE" "$CYCLE_DIR"
}

start_ts="$(date +%s)"
start_human="$(date '+%Y-%m-%d %H:%M:%S')"
status="pass"
test_runs=0
fix_attempts_used=0

snapshot_code_state "$CYCLE_DIR/code-state-start.tsv"

"$AUTOMATION_DIR/scripts/reset_state.sh" "$ENV_FILE" >"$CYCLE_DIR/reset.log" 2>&1
"$AUTOMATION_DIR/scripts/start_services.sh" "$ENV_FILE" "$CYCLE_DIR"
"$AUTOMATION_DIR/scripts/run_codex_explorer.sh" "$ENV_FILE" "$CYCLE_DIR" || true

if run_tests; then
  status="pass"
else
  status="failed-initial"

  max_attempts="$CODEX_FIX_ATTEMPTS"
  attempt=1
  while (( attempt <= max_attempts )); do
    fix_attempts_used=$attempt
    "$AUTOMATION_DIR/scripts/run_codex_fix.sh" "$ENV_FILE" "$CYCLE_DIR" "$attempt" || true

    if run_tests; then
      status="pass-after-fix"
      break
    fi

    attempt=$((attempt + 1))
  done

  if [[ "$status" != "pass-after-fix" ]]; then
    status="failed-after-fixes"
  fi
fi

snapshot_code_state "$CYCLE_DIR/code-state-end.tsv"
collect_code_changes \
  "$CYCLE_DIR/code-state-start.tsv" \
  "$CYCLE_DIR/code-state-end.tsv" \
  "$CYCLE_DIR/code-changes.txt"

end_ts="$(date +%s)"
end_human="$(date '+%Y-%m-%d %H:%M:%S')"
duration=$((end_ts - start_ts))

cat > "$CYCLE_DIR/summary.txt" <<SUMMARY
cycle=$CYCLE_NUM
status=$status
sweep_mode=$sweep_mode
duration_seconds=$duration
started_at=$start_human
ended_at=$end_human
playwright_runs=$test_runs
fix_attempts_used=$fix_attempts_used
pw_test_targets=$PW_TEST_TARGETS
effective_test_targets=$effective_test_targets
pw_projects=$PW_PROJECTS
SUMMARY

changes_count="0"
if [[ -s "$CYCLE_DIR/code-changes.txt" ]]; then
  changes_count="$(wc -l < "$CYCLE_DIR/code-changes.txt" | tr -d ' ')"
fi

{
  echo "# Cycle $CYCLE_NUM Report"
  echo
  echo "- Status: $status"
  echo "- Sweep mode: $sweep_mode"
  echo "- Started: $start_human"
  echo "- Ended: $end_human"
  echo "- Duration: ${duration}s"
  echo "- Playwright runs in cycle: $test_runs"
  echo "- Tests configured: \`$effective_test_targets\`"
  echo "- Projects: \`$PW_PROJECTS\`"
  echo "- Workers: $PW_WORKERS"
  echo "- Retries: $PW_RETRIES"
  echo "- Max failures per run: $PW_MAX_FAILURES"
  echo "- Codex explorer enabled: \`$RUN_CODEX_EXPLORER\`"
  echo "- Codex fix enabled: \`$RUN_CODEX_ON_FAILURE\`"
  echo "- Codex fix attempts used: $fix_attempts_used/$CODEX_FIX_ATTEMPTS"
  echo "- Code files changed in cycle: $changes_count"
  echo
  echo "## Code Changes"
  if [[ -s "$CYCLE_DIR/code-changes.txt" ]]; then
    while IFS= read -r file; do
      echo "- \`$file\`"
    done < "$CYCLE_DIR/code-changes.txt"
  else
    echo "- none"
  fi
} > "$CYCLE_DIR/report.md"

append_running_report

log INFO "Cycle $CYCLE_NUM finished with status=$status in ${duration}s"

if [[ "$status" == "failed-after-fixes" ]]; then
  exit 1
fi
