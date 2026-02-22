You are running an exploratory browser QA + bug-fix pass on this repository.

Goals:
1) Use the Playwright MCP browser to execute diverse role-based flows and edge cases.
2) If you find a defect, fix the code directly.
3) Run fast local checks after each fix (`npm --prefix frontend run build` and `npm --prefix backend run typecheck`).
4) Keep changes minimal and targeted.
5) Log what you validated and what you changed.

Constraints:
- Focus on real user journeys for admin/organizer/participant.
- Include negative and boundary interactions.
- Prefer deterministic checks over subjective UI checks.
- Do not stop at first failure; continue testing and fixing for the available time.
- If no bug is found, add at least one additional meaningful Playwright test under `automation/playwright/tests` for an edge case you validated.

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
