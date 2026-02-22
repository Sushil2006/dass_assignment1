#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/common.sh"
ENV_FILE="${1:-$ENV_FILE_DEFAULT}"
load_env "$ENV_FILE"

log INFO "Starting overnight loop with MAX_CYCLES=$MAX_CYCLES"

run_started_at="$(date +%s)"
report_file="$REPORTS_DIR/overnight-$(date +%Y%m%d-%H%M%S).md"

pass_count=0
partial_count=0
fail_count=0

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
  fi

done

run_ended_at="$(date +%s)"
run_duration=$((run_ended_at - run_started_at))

cat > "$report_file" <<EOF_REPORT
# Overnight Automation Report

Date: $(date '+%Y-%m-%d %H:%M:%S')

- Total cycles: $MAX_CYCLES
- Passed directly: $pass_count
- Passed after fix: $partial_count
- Failed/timed out: $fail_count
- Total duration (seconds): $run_duration

## Cycle Summaries

$(for (( cycle=1; cycle<=MAX_CYCLES; cycle++ )); do
  summary="$ARTIFACTS_DIR/cycle-$cycle/summary.txt"
  if [[ -f "$summary" ]]; then
    printf -- "- cycle-%s: %s\n" "$cycle" "$(tr '\n' ' ' < "$summary")"
  else
    printf -- "- cycle-%s: no summary (timeout/crash before summary write)\n" "$cycle"
  fi
done)

EOF_REPORT

log INFO "Overnight loop finished"
log INFO "Report: $report_file"
