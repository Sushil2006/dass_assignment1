# Overnight Browser Automation Setup

This folder provides a production-style overnight loop for your app:

- reset DB + deterministic seed every cycle
- start backend/frontend in isolated ports
- run Playwright browser E2E suite with traces/screenshots/video on failure
- run Codex (`codex exec`) to explore/fix using Playwright MCP
- rerun tests and keep going without stopping
- write artifacts and logs per cycle

## Folder layout

- `automation/.env.overnight`: all runtime settings
- `automation/scripts/`: orchestration scripts
- `automation/playwright/`: deterministic E2E tests + Playwright config
- `automation/prompts/`: prompts for Codex exploratory/fix runs
- `automation/artifacts/`: per-cycle logs and Playwright artifacts
- `automation/reports/`: final overnight summary files

## One-time setup

Run:

```bash
bash automation/scripts/preflight.sh
```

This installs npm dependencies and Playwright Chromium for the automation suite.

## Quick smoke run

Run one cycle:

```bash
bash automation/scripts/run_cycle.sh --cycle 1
```

## Overnight run

Run the full autonomous loop:

```bash
bash automation/scripts/overnight_loop.sh
```

The script will keep cycling until `MAX_CYCLES` or manual stop.
It continuously updates a live report under:

- `automation/reports/overnight-running-<timestamp>.md`

## Safe stop

Use Ctrl+C on the loop script. It traps shutdown and stops app services.

## Tuning knobs

Edit `automation/.env.overnight`:

- `MAX_CYCLES`
- `CYCLE_TIMEOUT_MINUTES`
- `CODEX_TIMEOUT_MINUTES`
- `CODEX_FIX_ATTEMPTS`
- `CODEX_MODEL`
- `CODEX_REASONING_EFFORT`
- `RUN_CODEX_EXPLORER`
- `RUN_CODEX_ON_FAILURE`
- `PW_WORKERS`
- `PW_TEST_TARGETS` (default excludes the heavier admin organizer creation flow)
- `PW_FULL_TEST_TARGETS`
- `FULL_SWEEP_EVERY_CYCLES`

`PW_TEST_TARGETS` supports:
- `auto-smoke`: run `*.smoke.spec.js`, fallback to core baseline tests
- explicit space-separated paths: run only those files

`PW_FULL_TEST_TARGETS` supports:
- `auto-all`: run all `tests/*.spec.js` files (includes newly added tests automatically)
- explicit space-separated paths

Naming convention for new tests:
- `*.smoke.spec.js`: runs every cycle in `auto-smoke` mode
- `*.spec.js`: runs in periodic full sweeps (`auto-all`)

Recommended stable overnight values:

- `MAX_CYCLES=200`
- `CYCLE_TIMEOUT_MINUTES=45`
- `CODEX_TIMEOUT_MINUTES=20`
- `CODEX_FIX_ATTEMPTS=2`
- `PW_WORKERS=2`
- `PW_RETRIES=0`
- `PW_PROJECTS=chromium-desktop`
- `FULL_SWEEP_EVERY_CYCLES=10`

## Notes

- This setup assumes local MongoDB is reachable at `127.0.0.1:27017`.
- App source edits are allowed during codex fix cycles.
- Artifacts can grow quickly; clean old runs under `automation/artifacts/`.
