# Halo Database overseas website

Passed Stage 7 frontend plus the Stage 8 fail-closed discovery/security foundation for the approved Halo Database overseas site. The application uses Vinext and React, targets the Cloudflare Workers runtime, and keeps the public information architecture server-rendered.

## Requirements

- Node.js `>=22.13.0`
- npm `>=11`

## Commands

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run verify
```

`npm test` performs a production build and checks all active routes, exact titles and H1s, canonical trailing-slash normalization, 404/gate behavior, semantic landmarks, internal destinations, P05/P07/P08 structure, the absence of gated copy in public assets, Stage 8 release-origin validation, robots/sitemap behavior, closed analytics vocabulary, atomic gates, and response security/cache policy. `npm run verify` is the complete repeatable check: lint, TypeScript, build, and the production-output acceptance suites.

## Current release boundary

- Active content routes are rendered from `lib/site-content.ts`.
- Case Studies, the Partner Application, Privacy, and Accessibility remain inactive and return the approved 404 shell. The public Partners route is information-only.
- Prepare a PoC, Commercial Planning, and Plan a Demo are approved no-form preparation shells. Forms, submission states, backend routing, and analytics remain inactive until A06/A12; the Partner Application also requires A08.
- Preview and unapproved hosts are `noindex`, publish a crawl-blocking robots policy, and return an empty sitemap. Absolute canonical/OG URL, the production sitemap, and minimal WebSite schema require `SITE_RELEASE_MODE=production`, `SITE_RELEASE_APPROVED=true`, and an exact validated `SITE_CANONICAL_ORIGIN` that matches the request origin. These non-secret runtime values must not be guessed or committed as placeholders.
- Analytics is a deliberately no-op closed schema; no tracker, cookie, identifier, or event request is present.
- The legal entity, physical address, customer proof, support matrix, exact HA topology, and other gated claims are deliberately absent until their recorded approvals pass. Public contact is limited to the approved company email.
- The Stage 7 release intentionally uses the design system's declared system-font fallbacks. No unapproved font binary is bundled; approved licensed Inter Variable and IBM Plex Mono WOFF2 assets can replace the fallback branch in a focused asset review.

## Structure

- `app/` — routes, semantic renderers, shell components, and design-system CSS
- `lib/site-content.ts` — typed frozen public-content registry and gate records
- `worker/index.ts` — Vinext Worker entry and direct unmatched-route 404 guard
- `tests/rendered-html.test.mjs` — production-output acceptance suite
- `.openai/hosting.json` — Sites deployment bindings (none required in Stage 7)
