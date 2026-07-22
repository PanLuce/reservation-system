# CLAUDE.md — reservation-system

## Project shape

Centrum Rubacek booking app. Single Express 5 + TypeScript server serving a Czech-language UI for managing group activity reservations (courses, lessons, participants). Database: Turso/libSQL via `@libsql/client`. Deployed to Render. Auth via express-session + bcrypt. Email via nodemailer.

Entry points: `start.mjs` → `server.ts` (main router/middleware), modules in `src/` (auth, database, program, course,
lesson, participant, registration-db, credit, email-service, ods-loader, session-store, etc.).

## Build & run

Always use existing npm scripts. If a script fails, fix the script — do not work around it.

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with watch mode |
| `npm start` | Production start |
| `npm run build` | TypeScript compile (`tsc`) |
| `npm run typecheck` | Type-check only, no emit |
| `npm run lint` | Biome check |
| `npm run lint:fix` | Biome check + auto-fix |
| `npm run format` | Biome format |
| `npm test` | Playwright E2E tests |
| `npm run test:ui` | Playwright with UI |
| `npm run test:headed` | Playwright headed |
| `npm run test:debug` | Playwright debug |

## Tooling

- **Linter/formatter**: Biome only. No ESLint, no Prettier.
- **Tests**: Playwright E2E only (`tests/`, smoke tests in `smoke/`). No Vitest, no Jest, no unit-test layer.
- **TypeScript**: strict mode. No `any`.

## Conventions

- No comments unless the *why* is non-obvious (a hidden constraint, a workaround, a subtle invariant). Self-documenting names preferred over comments.
- No commented-out code.
- No `any` types.
- Czech UI strings are intentional — do not anglicize them.
- New code belongs in `src/` modules rather than growing `server.ts` further.
- Error handling via exceptions, not return codes.

## Tests

Playwright tests in `tests/` must be independent and seed their own data. Do not rely on shared mutable state between tests or a specific test execution order. Run with `npm test`.

## Deployment

CI (`ci.yml`) runs typecheck → lint → test on every push and PR to `main`, then triggers a Render deploy on push to
`main` via `RENDER_DEPLOY_HOOK_URL`. There is also a manual smoke test workflow (`smoke-login.yml`) that runs Playwright
against production, and a scheduled `backup-db.yml` that dumps the DB to a GitHub artifact.

### Quick-login buttons (pre-go-live testing only)

The login page can render one-click "Přihlásit jako admin" / "Přihlásit jako rodič"
buttons (`public/login.js`, `src/routes/auth.ts`'s `GET /api/test-accounts`). This is a
pure env-var switch — no code change needed to enable or disable it anywhere.

- Local dev: enabled by default via the `dev` npm script (`ENABLE_QUICK_LOGIN=true`).
  Seeds `admin@centrumrubacek.cz`/`admin123` and `maminka@test.cz`/`test123`.
- Production (Render dashboard): set `ENABLE_QUICK_LOGIN=true` plus `ADMIN_EMAIL_SEED`,
  `ADMIN_PASSWORD_SEED`, `PARTICIPANT_EMAIL_SEED`, `PARTICIPANT_PASSWORD_SEED`, then
  redeploy/restart. Without the `*_SEED` vars, production skips seeding those accounts
  even with the flag on, and the buttons will 404-fail to log in.
- **Before real go-live**: set `ENABLE_QUICK_LOGIN=false` (or unset it) in the Render
  dashboard. Enabling it in production exposes one-click admin login with known
  credentials on a public URL — acceptable only for the pre-go-live testing window.
