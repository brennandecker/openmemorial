# Family approval

Anyone may submit a plain-text memory. New records always enter `pending`, remain absent from the public API, and require one authorized reviewer to publish them. The curated opening verse is source content rather than a visitor submission.

## Private review

`/family` provides Waiting, Published, Declined, and Hidden queues. Either reviewer may approve a pending memory, decline it, hide a published memory, or republish a declined/hidden memory. Decisions retain their reviewer, timestamp, and a private audit history. Review versions prevent concurrent decisions from overwriting each other. Review pages and responses use `private, no-store` and `noindex` headers.

Open **Review history** on a memory to see every decision, reviewer email, and time (newest first, paginated). `/family/api/notes/:id/history` requires the same independently verified family identity as the review commands. History is never included in the public notes API.

Declined memories are retained privately for at least 60 days to allow recovery. There is no delete command and no automatic purge job; they remain recoverable after that period. A reviewer can Publish from Declined. Site administrators handle verified privacy-removal requests separately, which may override normal retention. Before adding an eventual purge job, define how it handles recoverability, privacy requests, backups, and minimal audit records; update the privacy notice to match.

`/login` is a branded public entry page; `/family` still runs the secure Cloudflare Access email-code flow. It does not replace Access or proxy credentials. Per-application HTML/Liquid login templates require an eligible paid Zero Trust plan. Do not change organization-wide branding for a single memorial. Public `/privacy` and `/terms` pages are linked from the footer and submission form. Configure the public contact in `src/sitePolicy.ts` and adapt the policies to your deployment before publishing. Inbound forwarding is configured in Cloudflare Email Routing, not in frontend code.

Protect `/family` and all its descendants with a Cloudflare Access self-hosted application. Configure One-time PIN as its login method. Create a reusable Allow policy containing exact reviewer email addresses; avoid allowing a whole email domain. Attach that policy to the application. Everyone else is denied. The API additionally validates Access's RS256 signature, issuer, audience, expiry, and exact email allowlist. A direct request to another Worker hostname cannot bypass API authorization.

Set these Worker secret bindings using your own Cloudflare account's secret manager. No values belong in source or frontend environment variables:

- `ACCESS_TEAM_DOMAIN`: the HTTPS origin of the Cloudflare Access organization, with no trailing slash.
- `ACCESS_AUD`: the audience tag of this specific review application.
- `MODERATOR_EMAILS`: comma-separated, exact reviewer email addresses.
- `TURNSTILE_SITEKEY`: the widget's public sitekey; `/api/config` exposes only this value.
- `TURNSTILE_SECRET`: the widget's private verification secret.
- `TURNSTILE_HOSTNAMES`: the exact hostnames accepted by this deployment, separated by commas. Production must exclude localhost.

To replace a reviewer, update both the Access policy and `MODERATOR_EMAILS`. The app's independent allowlist takes effect on the next API request even if an old Access session still exists. Changing an address does not transfer its past approval records to another identity.

## Submission protection

Register a managed Turnstile widget for your memorial hostname. The form loads it only when sharing a memory. The server calls Siteverify and requires success, the `share_memory` action, and the exact request hostname. Verification fails closed. Tokens are single-use. A failed submission retains the visitor's draft and refreshes verification. Existing same-origin checks, bounded streamed requests, plain-text rendering, honeypot, and network rate limit remain active. The database does not store visitor IP addresses.

Apply both D1 migrations before deploying the new handler:

```sh
npx wrangler d1 migrations apply NOTES --remote
npm run build
npm run deploy
```

The second migration retains existing visitor records and preserves their visibility: previously public records become approved, and previously hidden records remain hidden. New submissions default to pending. It also hides pending inserts from older handlers during rollout. It does not modify family photographs or the opening verse. Use a D1 export for backups; source archives do not contain submissions or approval history. After enabling approvals, deploy fixes using an approval-aware handler.

For a local Worker preview, use a separate local database and local-only secrets, a test Access signing setup, and Cloudflare's documented Turnstile test keys. Never introduce a production authentication bypass or production test key. The Vite frontend alone has no approval backend.

## Checks

`npm test` exercises SQLite persistence, pending privacy, signed reviewer identities, wrong audiences, expiry, forged tokens, unauthorized reviewers, CSRF, simulated verification failures and replay, concurrent decisions, approval history, and public date pagination. Production verification also needs a real browser submission and a login to an allowed review inbox. The owner must complete emailed sign-in codes; application code never reads the review inbox.
