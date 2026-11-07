# Family approval

Anyone may submit a memory with text, one photograph, or both. New records always enter `pending`, remain absent from the public API, and require one authorized reviewer to publish them. The curated opening verse is source content rather than a visitor submission.

## One optional photograph

The form accepts words, one photograph, or both. The contributor provides a display name and permission acknowledgment; email is optional and private. Each photo can have a caption, a capture date with year/month/day precision, explicitly identified people, and a city/state location. Camera dates are suggested locally with `exifr`; GPS is not read. Corrections change the date source from camera to family.

Configure `MEMORY_PHOTOS` as a private R2 bucket and `IMAGES` as a Cloudflare Images binding. Keep the bucket's r2.dev URL disabled and do not attach a public custom domain. The Worker accepts at most one file and 10 MB, verifies the actual image with Images, rejects SVG and unsupported formats, caps input dimensions at 40 megapixels, and re-encodes to a JPEG up to 2560 pixels per side. It removes EXIF, XMP, IPTC and comments; the original is not stored. A failed database insert cleans up its unreferenced processed object.

`/api/photos/:id` checks the database's current approval and visibility on every request. `/family/api/notes/:id/photo` requires the independently verified family identity. Both return `private, no-store`; image URLs never point directly to R2. Hiding or declining a memory also denies public image access. Its image remains recoverable alongside its record for at least 60 days, with no automatic purge. Family photo-detail corrections are saved with the approval transaction, version check, and before/after audit snapshots. Optional contact emails never enter public notes or catalog responses.

Apply migration `0003_memory_photos.sql` before deploying. It preserves existing records and their visibility. `memory_text` contains the actual contributor text, including an empty string for photo-only contributions; legacy `body` remains nonempty for compatibility with the original schema. Photos filter by capture date and text notes by posting date, before pagination. The public people/location catalog includes only approved submissions and curated source tags.

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

Apply all D1 migrations before deploying the new handler:

```sh
npx wrangler d1 migrations apply NOTES --remote
npm run build
npm run deploy
```

The second migration retains existing visitor records and preserves their visibility: previously public records become approved, and previously hidden records remain hidden. New submissions default to pending. It also hides pending inserts from older handlers during rollout. It does not modify family photographs or the opening verse. Use a D1 export for backups; source archives do not contain submissions or approval history. After enabling approvals, deploy fixes using an approval-aware handler.

For a local Worker preview, use a separate local database and local-only secrets, a test Access signing setup, and Cloudflare's documented Turnstile test keys. Never introduce a production authentication bypass or production test key. The Vite frontend alone has no approval backend.

## Checks

`npm test` exercises SQLite persistence, pending privacy, signed reviewer identities, wrong audiences, expiry, forged tokens, unauthorized reviewers, CSRF, simulated verification failures and replay, concurrent decisions, approval history, and public date pagination. Production verification also needs a real browser submission and a login to an allowed review inbox. The owner must complete emailed sign-in codes; application code never reads the review inbox.

## Memory intake and notification

Sharing starts with a note/photo choice. A photograph keeps its optional note. Visitors enter or select people and a location, explicitly choose a camera date, an entered date, or unknown, and preview the front and back before **Share to wall**. Original candidate dates and their choice stay private in `dateEvidence`; only the approved capture date appears publicly. The family can see both candidates while reviewing.

For email notifications, onboard a sending domain in Cloudflare Email Service, configure the restricted `FAMILY_EMAIL` send binding, and set `NOTIFICATION_FROM` and `NOTIFICATION_REVIEW_URL`. The recipients are the private `MODERATOR_EMAILS` allowlist. Email contains only a secure review link, with no contributor content or attachments. The confirmation says the family was notified only after the email service accepts the message. If email fails, the saved memory remains in the private queue and the confirmation says it was sent for review; structured logs record the notification failure. Inbox delivery is controlled by the receiving mail provider.

Photo intake uses one editable row per person and **+ Add person**, with suggestions from approved people. Names preserve contributor order and form the front caption; the optional note belongs on the back. City, state/region, and country are separate optional fields, preserved in `photo_json.place` and the approved location catalog. Unknown parts stay absent. Older name lists and location labels remain readable and reviewable. No database migration is required for the additional JSON fields.


## Family wall management

Apply `0004_wall_management.sql` before deploying this version. `/family` separates **Visitor memories** from the **Original wall**. Authorized family managers can edit text, attribution, photo names, capture dates, and location; save changes without publishing private drafts; and hide/restore wall cards. Visitor approval remains required. Each edit records its authenticated reviewer, time, and private before/after snapshot. **Change history → See before and after → Restore these previous details** recovers content without changing visibility. Conflicting edits return 409 instead of overwriting another manager’s change. Existing moderation decisions stay in their original audit table.

Original wall cards are defined in `src/memorial.ts`, `src/photoWallData.ts`, and `src/wallNotes.ts`; database overrides keyed by stable IDs take precedence after family edits. Keep IDs stable across source releases. The portrait and memorial identity remain deployment settings. Hiding an original removes it from the wall, filters, and in-page slideshow; its previously public static asset is not a confidential storage object. New visitor photographs remain private R2 objects and their public endpoint immediately denies access when hidden. Back up `wall_curated_edits`, `wall_content_changes`, the existing D1 tables, and R2 separately from source code.

The `posted_on` column records note posting days in the configured home time zone. When upgrading an existing deployment, backfill legacy rows from `created_at` using `postedDay` from `src/wallSettings.ts`; the migration’s UTC fallback is only a compatibility default. Update the exact Access email policy, `MODERATOR_EMAILS`, and `FAMILY_EMAIL.allowed_destination_addresses` together when inviting a family manager. Email notifications contain only a secure review link.
