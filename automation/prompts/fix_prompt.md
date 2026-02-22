Playwright suite failed in this repository.

Task:
1) Read failure context from the provided cycle artifact files.
2) Reproduce the failure.
3) Fix root cause in application code or flaky test code.
4) Re-run relevant checks:
   - npm --prefix frontend run build
   - npm --prefix backend run typecheck
   - bash automation/scripts/run_playwright_suite.sh
5) If still failing, keep iterating until time budget is reached.

Rules:
- Prioritize correctness and deterministic behavior.
- Avoid broad refactors.
- Preserve existing user-visible behavior unless it is clearly wrong.
- If a test is wrong, fix the test with explicit rationale in your final summary.
- Never run `sudo`, `su`, `apt`, `apt-get`, `dnf`, `yum`, or any system-level package install command.

Deliverables:
- Short failure root-cause explanation.
- Files changed.
- Validation commands run and outcomes.
