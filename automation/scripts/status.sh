#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "=== Loop Status @ $(date '+%Y-%m-%d %H:%M:%S') ==="

loop_line="$(pgrep -af 'bash automation/scripts/overnight_loop.sh automation/.env.overnight' | head -n 1 || true)"
if [[ -n "$loop_line" ]]; then
  echo "Loop process: $loop_line"
else
  echo "Loop process: not running"
fi

cycle_line="$(pgrep -af '/automation/scripts/run_cycle.sh --cycle' | head -n 1 || true)"
active_cycle=""
if [[ -n "$cycle_line" ]]; then
  echo "Current cycle process: $cycle_line"
  if [[ "$cycle_line" =~ --cycle[[:space:]]+([^[:space:]]+) ]]; then
    active_cycle="${BASH_REMATCH[1]}"
  fi
else
  echo "Current cycle process: none"
fi

echo
latest_running="$(ls -t "$ROOT_DIR"/automation/reports/overnight-running-*.md 2>/dev/null | head -n 1 || true)"
if [[ -n "$latest_running" ]]; then
  echo "Latest running report: $latest_running"
  echo "--- tail running report ---"
  tail -n 30 "$latest_running"
else
  echo "Latest running report: none"
fi

echo
latest_console="$(ls -t "$ROOT_DIR"/automation/reports/overnight-console-*.log 2>/dev/null | head -n 1 || true)"
if [[ -n "$latest_console" ]]; then
  echo "Latest console log: $latest_console"
  echo "--- tail console log ---"
  tail -n 30 "$latest_console"
else
  echo "Latest console log: none"
fi

echo
latest_cycle_dir="$(ls -dt "$ROOT_DIR"/automation/artifacts/cycle-* 2>/dev/null | head -n 1 || true)"
if [[ -n "$active_cycle" ]]; then
  candidate_dir="$ROOT_DIR/automation/artifacts/cycle-$active_cycle"
  if [[ -d "$candidate_dir" ]]; then
    latest_cycle_dir="$candidate_dir"
  fi
fi
if [[ -n "$latest_cycle_dir" ]]; then
  echo "Latest cycle artifacts: $latest_cycle_dir"
  if [[ -f "$latest_cycle_dir/driver.log" ]]; then
    echo "--- tail driver log ---"
    tail -n 25 "$latest_cycle_dir/driver.log"
  fi
  if [[ -f "$latest_cycle_dir/summary.txt" ]]; then
    echo "--- summary ---"
    cat "$latest_cycle_dir/summary.txt"
  fi

  if [[ -f "$latest_cycle_dir/playwright/stdout.log" ]]; then
    echo "--- tail playwright stdout ---"
    tail -n 25 "$latest_cycle_dir/playwright/stdout.log"
  fi

  if [[ -f "$latest_cycle_dir/codex-explorer.log" ]]; then
    echo "--- tail codex explorer ---"
    tail -n 25 "$latest_cycle_dir/codex-explorer.log"
  fi

  if [[ -f "$latest_cycle_dir/codex-fix-1.log" ]]; then
    echo "--- tail codex fix attempt 1 ---"
    tail -n 25 "$latest_cycle_dir/codex-fix-1.log"
  fi
else
  echo "Latest cycle artifacts: none"
fi
