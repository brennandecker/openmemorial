# OpenMemorial

An MIT-licensed memorial website that families can own, personalize, and host themselves. A quiet scrapbook of photographs, memories, and the people who mattered.

OpenMemorial is built with React, TypeScript, Vite, and a Cloudflare Worker with D1 for moderated visitor memories. There is no proprietary site-builder or AI account requirement.

## Features

- A responsive photo wall with captions, dates, ages, locations, and people.
- Full-screen photographs and a slideshow of the current selection.
- A year-range slider and multi-select people and location filters.
- Visitor memories held privately until family approval.
- Email-code family sign-in, reversible moderation decisions, and a private review history.
- Bot verification, a privacy notice, and terms that each operator can adapt.

The starter contains no real family's photographs, names, dates, submissions, or credentials. It opens with an empty wall until you add your own content. The application code is MIT licensed; memorial content has separate ownership.

## Start a memorial

Begin with **[START_HERE.md](START_HERE.md)**. It includes a prompt for an assistant and a guided path for people who do not write code. The same setup works without an AI assistant.

```sh
npm ci
npm run setup
npm run dev
```

The local setup gathers memorial details, prepares photographs without embedded private metadata, and saves private progress. Review the preview, then follow **[SETUP.md](SETUP.md)** to connect Cloudflare, check readiness, and publish. Use a private repository for family content. Nothing is published by the local setup command.

## Free starter

The default configuration uses a free `workers.dev` address, bundled family photographs, D1, and optional moderated visitor **text** notes protected by Turnstile and family email-code sign-in. The connector creates the required resources without enabling R2, image storage, outgoing email, or a purchased domain. A blank starter stays read-only until authentication and bot checks are configured.

Open-source software is free; third-party usage is subject to provider limits. Read **[COSTS.md](COSTS.md)** for the exact distinction. Visitor photo uploads remain an optional operator-configured feature because R2 requires subscription checkout. The installer never silently upgrades a plan.

[![Deploy a blank starter to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/brennandecker/openmemorial)

The button launches a blank, read-only starter. Follow the guided setup for personalization and visitor notes; it does not complete account onboarding for you.

## Check and publish

```sh
npm run setup:cloudflare -- plan
npm run setup:cloudflare -- connect --apply
npm run doctor -- --remote
npm run setup:cloudflare -- publish --apply
npm run setup:cloudflare -- verify
```

Account credentials stay in the local process environment. Private resource state and runtime secrets stay under ignored `.openmemorial/`. The doctor checks account targeting, optional-cost exclusions, family access, and bot verification before publishing. Publishing runs schema migrations and reports live checks separately from building. Family sign-in and one real approval cycle must still be checked by the family.

Developer checks:

```sh
npm test
npm run build
```

The application code is MIT licensed; family content remains owned by its contributors. This repository contains no real family content. Configure a public privacy/removal contact and review the policy pages before publishing. Source archives do not replace backups of the database or optional photo storage.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and content guidelines, and [SECURITY.md](SECURITY.md) for private vulnerability reporting. The included GitHub Actions workflow runs tests and builds; it does not deploy your memorial or need production secrets.

## Visitor photographs

Each memory accepts one optional photograph, up to 10 MB (JPEG, PNG, WebP, or HEIC). Words are optional when a photograph is attached. Photo details are optional; the family can correct them before approval. Contact email is private and optional.

Before deploying uploads, create a private R2 bucket with `npx wrangler r2 bucket create memorial-memory-photos`, set its name in `wrangler.jsonc`, and keep public bucket access disabled. The `IMAGES` binding processes photographs before storage; check your Cloudflare Images transformation allowance. Apply all D1 migrations, including `0003_memory_photos.sql`. Back up R2 separately alongside D1. See `MODERATION.md` for approval and retention behavior.

## Memory intake and notification

Sharing starts with a note/photo choice. A photograph keeps its optional note. Visitors enter or select people and a location, explicitly choose a camera date, an entered date, or unknown, and preview the front and back before **Share to wall**. Original candidate dates and their choice stay private in `dateEvidence`; only the approved capture date appears publicly. The family can see both candidates while reviewing.

For email notifications, onboard a sending domain in Cloudflare Email Service, configure the restricted `FAMILY_EMAIL` send binding, and set `NOTIFICATION_FROM` and `NOTIFICATION_REVIEW_URL`. The recipients are the private `MODERATOR_EMAILS` allowlist. Email contains only a secure review link, with no contributor content or attachments. The confirmation says the family was notified only after the email service accepts the message. If email fails, the saved memory remains in the private queue and the confirmation says it was sent for review; structured logs record the notification failure. Inbox delivery is controlled by the receiving mail provider.

Photo intake uses one editable row per person and **+ Add person**, with suggestions from approved people. Names preserve contributor order and form the front caption; the optional note belongs on the back. City, state/region, and country are separate optional fields, preserved in `photo_json.place` and the approved location catalog. Unknown parts stay absent. Older name lists and location labels remain readable and reviewable. No database migration is required for the additional JSON fields.


## Family wall management

Apply `0004_wall_management.sql` before deploying this version. `/family` separates **Visitor memories** from the **Original wall**. Authorized family managers can edit text, attribution, photo names, capture dates, and location; save changes without publishing private drafts; and hide/restore wall cards. Visitor approval remains required. Each edit records its authenticated reviewer, time, and private before/after snapshot. **Change history → See before and after → Restore these previous details** recovers content without changing visibility. Conflicting edits return 409 instead of overwriting another manager’s change. Existing moderation decisions stay in their original audit table.

Original wall cards are defined in `src/memorial.ts`, `src/photoWallData.ts`, and `src/wallNotes.ts`; database overrides keyed by stable IDs take precedence after family edits. Keep IDs stable across source releases. The portrait and memorial identity remain deployment settings. Hiding an original removes it from the wall, filters, and in-page slideshow; its previously public static asset is not a confidential storage object. New visitor photographs remain private R2 objects and their public endpoint immediately denies access when hidden. Back up `wall_curated_edits`, `wall_content_changes`, the existing D1 tables, and R2 separately from source code.

The `posted_on` column records note posting days in the configured home time zone. When upgrading an existing deployment, backfill legacy rows from `created_at` using `postedDay` from `src/wallSettings.ts`; the migration’s UTC fallback is only a compatibility default. Update the exact Access email policy, `MODERATOR_EMAILS`, and `FAMILY_EMAIL.allowed_destination_addresses` together when inviting a family manager. Email notifications contain only a secure review link.
