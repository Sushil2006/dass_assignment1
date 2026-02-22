You are running an exploratory browser QA + bug-fix pass on this repository.

Goals:
1) Use the Playwright MCP browser to execute diverse role-based flows and edge cases.
2) If you find a defect, fix the code directly.
3) Run fast local checks after each fix (`npm --prefix frontend run build` and `npm --prefix backend run typecheck`).
4) Keep changes minimal and targeted.
5) Log what you validated and what you changed.

Constraints:
- Focus on real user journeys for admin/organizer/participant, BASED ON THE AUTHORITATIVE SPEC PROVIDED IN THE FORM OF THE ASSIGNMENT DOCUMENT (../docs/assignment1.pdf) and the current codebase.
- Include negative and boundary interactions.
- Prefer deterministic checks over subjective UI checks.
- Do not stop at first failure; continue testing and fixing for the available time.
- If no bug is found, add at least one additional meaningful Playwright test under `automation/playwright/tests` for an edge case you validated.
- If the new test covers a critical always-on path (auth/rbac/core nav), name it as `*.smoke.spec.js` so it runs every cycle.
- Otherwise add it as regular `*.spec.js`; it will run in periodic full sweeps.
- Never run `sudo`, `su`, `apt`, `apt-get`, `dnf`, `yum`, or any system package install command.
- Never attempt to install browsers/system dependencies globally.
- If Playwright MCP browser launch fails due missing system browser, skip MCP browser actions and continue with repository Playwright suite + code fixes + new tests.

Environment:
- Frontend URL: http://127.0.0.1:4173
- Backend URL: http://127.0.0.1:4100
- Seeded admin: admin@iiit.ac.in / admin123
- Seeded organizer: organizer+overnight@example.com / Organizer#123
- Seeded participant: participant+overnight@example.com / Participant#123

Output:
- Summarize tested flows and discovered issues.
- List edited files.
- List remaining risks.
