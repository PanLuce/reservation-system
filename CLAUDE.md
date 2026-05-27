# CLAUDE.md — reservation-system

## Project shape

Centrum Rubacek booking app. Single Express 5 + TypeScript server serving a Czech-language UI for managing group activity reservations (courses, lessons, participants). Database: Turso/libSQL via `@libsql/client`. Deployed to Render. Auth via express-session + bcrypt. Email via nodemailer.

Entry points: `start.mjs` → `server.ts` (main router/middleware), modules in `src/` (auth, calendar, course, lesson, participant, email, xlsx-export, etc.).

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

CI (`ci.yml`) runs typecheck → lint → test on every PR, then triggers a Render deploy on push to `main` via `RENDER_DEPLOY_HOOK_URL`. There is also a manual smoke test workflow (`smoke-login.yml`) that runs Playwright against production.
