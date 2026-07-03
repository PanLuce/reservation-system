# Design: Disable "Přihlásit jako náhrada" past the midnight cutoff

Date: 2026-07-03
Requirement: docs/REQUIREMENTS.md item 1 — "Rodič management: When the lesson is
after the permitted time for cancelling, the button is still there enabled.
Disable it with tooltip explaining the situation in czech."

## Problem

The two "Odhlásit" (cancel) buttons were already fixed in PR #3 / commit e78cf0b:
past the midnight cutoff they render `disabled` with the tooltip
"Nelze odhlásit po půlnoci před lekcí" (public/app.js:420 and :1198), covered by
tests/req-cancel-button-cutoff.spec.ts.

The remaining offender is the **"Přihlásit jako náhrada"** (register as
substitute) button. The server enforces the same midnight cutoff for
self-registration (`isAfterMidnightCutoff` in src/registration-rules.ts, called
from `participantSelfRegister` in src/registration-db.ts:370), but the UI never
reflects it:

- public/app.js:414-417 (day modal, `renderDayLessons`): disabled only when the
  parent has 0 substitution credits — never for the cutoff.
- public/app.js:1269 (substitution candidates list): never disabled at all.

The `substitution-candidates` endpoint (server.ts:1101) returns lessons with
`date >= today`, so same-day lessons appear with an enabled button; clicking it
yields a server 403 — confusing UX, the exact symptom in the requirement.

## Decision

Frontend-only fix mirroring the existing PR #3 pattern (approach A of three
considered; server-side filtering was rejected because it hides the lesson
instead of explaining, contradicting the requirement's "tooltip explaining the
situation").

At both render sites, compute cutoff state with the existing `localDateString()`
helper (public/app.js:3):

- A lesson is past cutoff when `lessonDate <= localDateString()` — same
  comparison the Odhlásit buttons use (`canCancel = dateStr > todayStr`).
- Past cutoff: render the button `disabled` with tooltip
  **"Nelze se přihlásit jako náhrada po půlnoci před lekcí"**.
- Tooltip priority in the day modal: the cutoff tooltip wins over the 0-credit
  tooltip ("Potřebujete náhradu (aktuálně 0 kreditů)") — a disabled-for-time
  button should say why time is the reason, credits are irrelevant then.
- No server changes. `isAfterMidnightCutoff` remains the single source of
  enforcement; the UI change is purely informative.

Out of scope (deliberately): fixing the UTC `toISOString().slice(0,10)` "today"
in server.ts:1079 — that is backlog item 13, which lists all ~6 sites of that
bug class and should be fixed together.

## Testing

Playwright E2E, following the structure of tests/req-cancel-button-cutoff.spec.ts
(seed own data, independent tests):

1. Day modal: a substitution-candidate lesson dated today renders "Přihlásit
   jako náhrada" disabled with the Czech cutoff tooltip; a future-dated one
   renders it enabled (given ≥1 credit).
2. Substitution candidates list: same pair of assertions in the
   "Moje rezervace" candidates list.
3. Tooltip priority: today's lesson + 0 credits shows the cutoff tooltip, not
   the credit tooltip.

## Implementation slices (Iterative Boy checkpoints)

1. **Slice 1** — Red+Green: day-modal náhrada button (test + fix at
   app.js:414-417, including tooltip priority). User commits.
2. **Slice 2** — Red+Green: candidates-list náhrada button (test + fix at
   app.js:1269), full `npm test` run. User commits.

Max new files: 1 (the spec's test file, if not added to the existing cutoff
spec).