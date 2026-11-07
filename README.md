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

## Start

Requires Node 22.13+.

Choose **Use this template** on GitHub to create your own repository, or clone this one:

```sh
git clone https://github.com/brennandecker/openmemorial.git
cd openmemorial
```

```sh
npm ci
npm run dev
```

The public page is a wall of photographs. The top-right hamburger menu offers sharing a memory, filtering the wall, and starting a five-second-per-photo slideshow of the current filtered selection, with pause/play and navigation controls. Tap a photo to view it in a full-screen lightbox, or tap its ellipsis for the details on the back. Set memorial details in `src/memorial.ts`. The metadata catalog in `src/photoWallData.ts` holds stable media IDs, captions, messages, dates with day/month/year precision and source, dimensions, explicit people IDs, and hierarchical place IDs. `src/memoryMetadata.ts` defines the model and filters. Set the home time zone in `src/wallSettings.ts`. Filters combine content type, a two-handle year slider with lifetime-aware age, and multi-select people/location checkboxes. Selections match any person or location in their respective group, then intersect across groups. Notes use their posting date and are filtered on the server before pagination. Unknown dates/places remain unknown. See the model comments for reuse. Add your own photographs or video, and update `index.html`. The `/studio` route provides a local editor for drafting; it cannot publish changes. Visitor notes are stored privately in Cloudflare D1 and require approval before publication. See `MODERATION.md` for Access and Turnstile setup. Studio keepsake memories remain browser-local.

```sh
npm test
npm run build
npm run preview
```

## Host

The `dist/` build is ordinary HTML, CSS, and JavaScript. A compatible backend is required for public notes.

For Cloudflare, authenticate with `npx wrangler login`, create a database using `npx wrangler d1 create memorial-wall-notes`, and update its database ID and Worker name in `wrangler.jsonc`. Run `npx wrangler d1 migrations apply NOTES --remote`, then `npm run deploy`. For local posting, apply the migration with `--local`, build, and run `npx wrangler dev`. The Vite dev server previews only the frontend. Notes require authenticated family approval at `/family`, where approved notes can also be hidden or republished. Configure the required secret bindings and exact reviewer emails described in `MODERATION.md` before deploying. Back up D1 separately from source archives. Configure an optional first note in `src/wallNotes.ts`. Add your custom domain with Cloudflare or a `routes` entry in the configuration. No proprietary site-builder or AI account is required.

Before publishing, update `src/sitePolicy.ts` with a working public privacy contact and adapt `/privacy` and `/terms` to your actual practices. `/login` is a matching entry page leading to Cloudflare Access. Review history is visible per memory; declined memories have no automatic purge and are retained for at least 60 days.

This starter includes no family photographs, names, dates, or personal tributes. The application code is MIT licensed; Caveat is bundled under its OFL license. Add your own content with permission. No application analytics service is included; your hosting provider may process normal requests or apply its own zone-level analytics configuration.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and content guidelines, and [SECURITY.md](SECURITY.md) for private vulnerability reporting. The included GitHub Actions workflow runs tests and builds; it does not deploy your memorial or need production secrets.

## Visitor photographs

Each memory accepts one optional photograph, up to 10 MB (JPEG, PNG, WebP, or HEIC). Words are optional when a photograph is attached. Photo details are optional; the family can correct them before approval. Contact email is private and optional.

Before deploying uploads, create a private R2 bucket with `npx wrangler r2 bucket create memorial-memory-photos`, set its name in `wrangler.jsonc`, and keep public bucket access disabled. The `IMAGES` binding processes photographs before storage; check your Cloudflare Images transformation allowance. Apply all D1 migrations, including `0003_memory_photos.sql`. Back up R2 separately alongside D1. See `MODERATION.md` for approval and retention behavior.

## Memory intake and notification

Sharing starts with a note/photo choice. A photograph keeps its optional note. Visitors enter or select people and a location, explicitly choose a camera date, an entered date, or unknown, and preview the front and back before **Share to wall**. Original candidate dates and their choice stay private in `dateEvidence`; only the approved capture date appears publicly. The family can see both candidates while reviewing.

For email notifications, onboard a sending domain in Cloudflare Email Service, configure the restricted `FAMILY_EMAIL` send binding, and set `NOTIFICATION_FROM` and `NOTIFICATION_REVIEW_URL`. The recipients are the private `MODERATOR_EMAILS` allowlist. Email contains only a secure review link, with no contributor content or attachments. The confirmation says the family was notified only after the email service accepts the message. If email fails, the saved memory remains in the private queue and the confirmation says it was sent for review; structured logs record the notification failure. Inbox delivery is controlled by the receiving mail provider.
