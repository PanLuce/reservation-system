# WordPress Integration Guide

## Overview

This guide shows how to integrate the Centrum Rubáček Reservation System into the
`centrumrubacek.cz` WordPress website.

## Integration method: subdomain redirect

The app is deployed at its own subdomain (`reservations.centrumrubacek.cz`) and
WordPress links to it. The user makes a normal top-level browser navigation into the
app and logs in there — no iframe.

**This is deliberate, not a shortcut.** The app's session cookie is host-scoped (no
`Domain` attribute) with `sameSite: "lax"`, and production sets
`X-Frame-Options: SAMEORIGIN` (see `server.ts`). Both are correct for a first-party
subdomain and both actively **break an iframe**:

- `sameSite: "lax"` suppresses the session cookie in a cross-site iframe context, so
  login inside a frame on `centrumrubacek.cz` would silently fail.
- `X-Frame-Options: SAMEORIGIN` (no CSP `frame-ancestors` override) means the browser
  refuses to render the app in a frame on any other origin at all — WordPress included.

Making iframe embedding work would require downgrading the cookie to
`sameSite: "none"` (a real security trade-off) plus CSP changes plus a `postMessage`
auto-height handshake that does not exist in the client code. None of that is
necessary: the redirect model works with the app exactly as it is today.

## Prerequisites

1. **Deployed application** — reachable over HTTPS, e.g.
   `https://reservations.centrumrubacek.cz`. See "Hosting" below.
2. **DNS access** for `centrumrubacek.cz` — to add a `reservations` CNAME.
3. **WordPress admin access** — to add a menu item, button, or link.

## Integration steps

1. **Deploy the app** to its subdomain (see Hosting below) and confirm
   `https://reservations.centrumrubacek.cz/health` returns `{"status":"ok",...}`.
2. **Add DNS record**: CNAME `reservations` → the hosting provider's target host.
3. **Add a link from WordPress**, e.g. a menu item or button labelled "Rezervace" /
   "Přihlásit se" pointing at `https://reservations.centrumrubacek.cz`. A plain `<a>`
   tag or WordPress menu item is enough — no plugin, shortcode, or custom PHP required.
4. **Publish** and click through: WordPress → link → app's `/login.html`.

## Hosting

The app is deployed on **Render** (see `render.yaml`), not Vercel:

- Region: Frankfurt, Node 20, `npm start`, health check `GET /health`.
- Required env vars: `NODE_ENV=production`, `SESSION_SECRET`, `ALLOWED_ORIGINS`,
  `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (see `docs/ENVIRONMENT_SETUP.md` /
  `docs/DEPLOYMENT.md` for the full list).
- **Do not skip `TURSO_DATABASE_URL`.** If unset, the app silently falls back to a
  local SQLite file on Render's ephemeral filesystem — the next redeploy wipes all
  data. See `docs/DESIGN_REVIEW.md` Stage 3 and `docs/REQUIREMENTS.md` item 10.
- Point the `reservations` CNAME at the Render service's custom-domain target, per
  Render's dashboard instructions for the deployed service.

## Optional: a WordPress-side schedule teaser

The redirect model needs nothing beyond a link. If a WordPress page later wants to
`fetch()` a live lesson list to render directly on the apex domain (e.g. an "upcoming
lessons" teaser), that is a cross-origin, credential-less read and needs:

- `ALLOWED_ORIGINS` to include `https://centrumrubacek.cz` (already the default in
  `server.ts`).
- One of the public read endpoints: `GET /api/lessons` or
  `GET /api/courses/:courseId/lessons`.

This is optional and separate from the core integration — booking/login still happens
on the app's own subdomain.

## Testing the integration

A Playwright harness (`tests/wordpress-pluggability.spec.ts`) exercises the contract
this doc depends on: the `/` → `/login.html` redirect, host-scoped `SameSite=Lax`
session cookie, `/health` and `/ready`, the public `GET /api/lessons` endpoint, and a
mock WordPress page linking into the app. Run it with `npm test`.

To test manually against a real deployment before pointing DNS at it, use the app's
Render preview/staging URL directly (no ngrok or iframe needed) — open it in a browser,
confirm the redirect and login, then swap in the final subdomain URL once DNS is live.

## Troubleshooting

### Issue: link from WordPress doesn't load the app

- Confirm `https://reservations.centrumrubacek.cz/health` works directly in a browser.
- Confirm the `reservations` CNAME has propagated (`dig reservations.centrumrubacek.cz`).
- Check the Render service is running and not sleeping (free plan).

### Issue: login fails after clicking the link

- Confirm the browser actually navigated to `reservations.centrumrubacek.cz` (check the
  address bar) rather than being loaded in a frame — the cookie is host-scoped and only
  works on a top-level navigation to the app's own origin.
- Confirm `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` are set in Render (otherwise sessions
  may not persist correctly across restarts).

### Issue: "Refused to display in a frame"

This is expected and correct — the app is deliberately not configured for iframe
embedding (see "Integration method" above). Use a link, not an iframe.

## Next steps

1. Deploy to Render with `TURSO_DATABASE_URL` set (see Hosting).
2. Point the `reservations` CNAME at Render.
3. Add the WordPress link.
4. Run `tests/wordpress-pluggability.spec.ts` / `smoke-login.yml` against the live URL.
5. Train users on the new link.
