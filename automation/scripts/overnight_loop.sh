#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/common.sh"
ENV_FILE="${1:-$ENV_FILE_DEFAULT}"
load_env "$ENV_FILE"

log INFO "Starting overnight loop with MAX_CYCLES=$MAX_CYCLES"

run_started_at="$(date +%s)"
run_started_human="$(date '+%Y-%m-%d %H:%M:%S')"
report_file="$REPORTS_DIR/overnight-running-$(date +%Y%m%d-%H%M%S).md"

pass_count=0
partial_count=0
fail_count=0

cat > "$report_file" <<EOF_REPORT
# Overnight Running Report

- Started at: $run_started_human
- Max cycles configured: $MAX_CYCLES
- Cycle timeout minutes: $CYCLE_TIMEOUT_MINUTES
- Codex explorer enabled: \`$RUN_CODEX_EXPLORER\`
- Codex fix enabled: \`$RUN_CODEX_ON_FAILURE\`
- Codex model: \`$CODEX_MODEL\`
- Codex reasoning effort: \`$CODEX_REASONING_EFFORT\`
- Playwright targets: \`$PW_TEST_TARGETS\`
- Playwright full-sweep targets: \`$PW_FULL_TEST_TARGETS\`
- Full sweep every N cycles: $FULL_SWEEP_EVERY_CYCLES
- Playwright projects: \`$PW_PROJECTS\`

## Cycle Updates

EOF_REPORT

export RUNNING_REPORT_FILE="$report_file"

for (( cycle=1; cycle<=MAX_CYCLES; cycle++ )); do
  log INFO "Running cycle $cycle/$MAX_CYCLES"

  cycle_log="$ARTIFACTS_DIR/cycle-$cycle/driver.log"
  mkdir -p "$(dirname "$cycle_log")"

  if timeout "${CYCLE_TIMEOUT_MINUTES}m" \
    "$AUTOMATION_DIR/scripts/run_cycle.sh" --cycle "$cycle" --env "$ENV_FILE" >"$cycle_log" 2>&1; then
    if grep -q 'status=pass-after-fix' "$ARTIFACTS_DIR/cycle-$cycle/summary.txt"; then
      partial_count=$((partial_count + 1))
    else
      pass_count=$((pass_count + 1))
    fi
  else
    fail_count=$((fail_count + 1))
    log WARN "Cycle $cycle failed or timed out"

    {
      echo "### Cycle $cycle"
      echo "- Status: timeout-or-crash"
      echo "- Changed: unknown (cycle did not complete cleanly)"
      echo "- Artifacts: \`$ARTIFACTS_DIR/cycle-$cycle\`"
      echo
    } >> "$report_file"
  fi

done

run_ended_at="$(date +%s)"
run_ended_human="$(date '+%Y-%m-%d %H:%M:%S')"
run_duration=$((run_ended_at - run_started_at))

{
  echo "## Final Totals"
  echo
  echo "- Ended at: $run_ended_human"
  echo "- Total cycles configured: $MAX_CYCLES"
  echo "- Passed directly: $pass_count"
  echo "- Passed after fix: $partial_count"
  echo "- Failed/timed out: $fail_count"
  echo "- Total duration (seconds): $run_duration"
} >> "$report_file"

log INFO "Overnight loop finished"
log INFO "Running report: $report_file"
