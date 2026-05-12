# Deployment Guide

## Overview

The app runs on **Render.com** (free tier, frankfurt region, Node 20) with **Turso** as the remote database. Deployments are gated by **GitHub Actions CI** — code only reaches Render after typecheck, lint, and the full Playwright test suite pass.

---

## Required environment variables

Set these in the Render dashboard (service → Environment):

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | yes | Set to `production` |
| `SESSION_SECRET` | yes | Random string for signing session cookies (`openssl rand -base64 32`) |
| `ALLOWED_ORIGINS` | yes | Comma-separated allowed CORS origins, e.g. `https://centrumrubacek.cz,https://reservations.centrumrubacek.cz` |
| `TURSO_DATABASE_URL` | yes | Turso database URL, e.g. `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | yes | Turso auth token |
| `ADMIN_EMAIL_SEED` | yes | Email for the seeded admin account, e.g. `admin@centrumrubacek.cz` |
| `ADMIN_PASSWORD_SEED` | yes | Password for the seeded admin account |
| `PARTICIPANT_EMAIL_SEED` | yes | Email for the seeded demo participant, e.g. `maminka@test.cz` |
| `PARTICIPANT_PASSWORD_SEED` | yes | Password for the seeded demo participant |
| `ENABLE_QUICK_LOGIN` | optional | Set to `true` to show one-click login buttons. Keep unset in real production. |
| `SMTP_HOST` | optional | SMTP server hostname for email sending |
| `SMTP_PORT` | optional | SMTP server port (e.g. `587`) |
| `SMTP_USER` | optional | SMTP username |
| `SMTP_PASS` | optional | SMTP password |
| `ADMIN_EMAIL` | optional | Admin email address for notifications |
| `FROM_EMAIL` | optional | Sender address for outgoing emails |
| `LOG_LEVEL` | optional | Winston log level, defaults to `info` in production |

> If `ADMIN_EMAIL_SEED`/`ADMIN_PASSWORD_SEED` or `PARTICIPANT_EMAIL_SEED`/`PARTICIPANT_PASSWORD_SEED` are missing, the app logs a warning and skips that seed — the corresponding account won't exist and login will fail.

---

## Initial Render service setup

The repo contains `render.yaml` — Render can use it as a Blueprint or you can configure manually:

1. Render dashboard → **New +** → **Web Service** → connect GitHub repository
2. Settings:
   - **Region**: Frankfurt (EU Central)
   - **Runtime**: Node
   - **Node version**: 20
   - **Build Command**: `npm ci --include=dev`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: Off (CI controls deploys via deploy hook)
3. Add all required environment variables from the table above.
4. Copy the **Deploy Hook URL** from Settings → Deploy Hooks — you'll need it for GitHub Actions.

---

## CI/CD flow

Push to `main` → GitHub Actions runs three parallel jobs:

1. **typecheck** — `tsc --noEmit`
2. **lint** — `biome check .`
3. **test** — Playwright suite (Chromium, ~291 tests)

If all three pass, a fourth **deploy** job fires the Render deploy hook via `curl -X POST "$RENDER_DEPLOY_HOOK_URL"`.

**Required GitHub secret**: `RENDER_DEPLOY_HOOK_URL` — set in repo Settings → Secrets → Actions.

---

## Custom domain

`reservations.centrumrubacek.cz` is hosted at Gransy / subreg.cz DNS. To point it at Render:

1. Render → service → Settings → Custom Domains → add `reservations.centrumrubacek.cz` → copy the `<service>.onrender.com` CNAME target.
2. Gransy DNS panel → edit the `reservations` CNAME record → set target to `<service>.onrender.com`.
3. DNS propagates within ~15 min (TTL is 900s). Render auto-issues a Let's Encrypt cert once DNS resolves.
4. Verify: `dig +short reservations.centrumrubacek.cz CNAME` returns the onrender.com host; `curl -I https://reservations.centrumrubacek.cz/health` returns 200.
5. Ensure `ALLOWED_ORIGINS` on Render includes `https://reservations.centrumrubacek.cz`.

---

## Cold-start note

Render free tier spins down after 15 min of inactivity. The first request after idle takes 30–60 s. If this becomes a problem for users, upgrade to Render Starter ($7/mo) — no code change needed.

---

## Rollback

Render dashboard → service → **Deploys** tab → click any prior successful deploy → **Rollback to this deploy**.
