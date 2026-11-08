# Create your memorial

OpenMemorial is free, open-source software. The guided **free starter** publishes family photographs and supports visitor text memories with private family approval. It uses Cloudflare’s free-plan services and a free `workers.dev` address. Service limits still apply; read [COSTS.md](COSTS.md). No subscription, domain purchase, R2 bucket, or outgoing email service is enabled by this installer.

You can ask an assistant to work through these steps with you. Use a private copy of this repository for family content. Keep `.openmemorial/` backed up privately; never upload its secrets to chat or GitHub.

## Start with your assistant

Copy this prompt into an assistant that can work with local files:

> Help me create a memorial using OpenMemorial. Read START_HERE.md and follow SETUP.md. Ask one question at a time, allow me to skip optional details, save my progress, and show a local preview early. Use the free Cloudflare profile. Never invent names, dates, locations, or personal tributes. Do not enable paid services or publish until I have reviewed the result. Keep family manager emails and credentials private.

An assistant with chat only can help prepare the answers file, but cannot execute setup or verify a deployment. It must say which steps need a person or a tool with file/deployment access. No AI subscription or AI API is required to run the resulting memorial.

## 1. Make a private working copy

Use **Use this template → Create a new repository** on GitHub and select **Private** before adding family content. Download or clone your copy. Install [Node.js](https://nodejs.org/) 22.13 or later, then run:

```sh
npm ci
npm run setup
```

Setup asks for the person’s name, optional life dates, a home time zone, a public privacy/removal email, and the family managers’ exact emails. Manager emails are saved only in ignored local setup state. They are not added to the public memorial files.

An assistant can instead prepare an answers file based on [memorial.example.json](memorial.example.json):

```sh
npm run setup -- --answers memorial.answers.json
```

Photo `file` paths are relative to that answers file, or absolute. Photos are processed locally into display JPEGs, resized if necessary, and stripped of embedded EXIF/GPS, XMP, IPTC, and comments. The originals remain on your computer. HEIC decoding depends on your system; convert HEIC to JPEG first if it cannot be read. Source files are backed up under `.openmemorial/backups/` before being personalized. The starter never deletes older source photographs automatically.

To inspect a camera date without reading GPS:

```sh
npm run photos:inspect -- /path/to/photo.jpg
```

Treat the camera date as a suggestion. Confirm it before putting it in the answers file. A year or year/month is fine; unknown dates stay blank. Give each photo its people, optional city/state/country, a front caption, and an optional note on the back. `portrait` is the photo’s zero-based index, or `null` to omit the header photograph.

## 2. Preview and save your progress

```sh
npm run dev
```

The Vite preview shows your photographs and content. The family review API and public posting require the configured Worker; the frontend preview alone cannot receive memories. Before publishing, confirm the name, life dates, photos, captions, privacy contact, and the privacy/terms pages. Your public contact email is intentionally visible; manager emails remain private.

When returning later, rerun setup to update the same memorial. Choose new names and a new folder for a different memorial. Keep media IDs stable once the family has edited them online; locally prepared copies have stable content-based IDs.

## 3. Connect Cloudflare

Create a Cloudflare account and choose the Workers **Free** plan. Choose your free Workers subdomain in the dashboard. For visitor notes, also complete Cloudflare Zero Trust’s **Free** onboarding for family email-code sign-in; the installer will not accept plan terms or change organization-wide settings for you. You can set `notes` to `false` for a read-only gallery.

Copy your account ID from Cloudflare into your saved answers, then rerun local setup. Use an account-scoped API token for that account with:

- Workers Scripts: Edit (the deployment and free Workers address).
- D1: Edit (the notes database and schema).
- Access: Apps and Policies: Edit (only this memorial’s family application/policy are changed).
- Access: Organizations, Identity Providers, and Groups: Edit (read the existing team and create/reuse email-code sign-in).
- Turnstile Sites: Edit (the memorial’s bot-verification widget).
- Account Settings: Read if your token needs it to read the Workers subdomain.

These names follow the [Cloudflare API permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/). Restrict the token to the chosen account. Do not grant DNS, billing, R2, or email permissions for the free starter. Never put your API token in an answers file or paste it into chat. Set `CLOUDFLARE_API_TOKEN` privately in your terminal or your development tool’s secret environment. The installer reads it only from the process environment and never includes it in deployed app secrets.

Review the plan, then explicitly create resources:

```sh
npm run setup:cloudflare -- plan
npm run setup:cloudflare -- connect --apply
npm run doctor -- --remote
```

The connector creates the D1 database, a production Turnstile widget for the exact hostname, and an Access application protecting `/family` and its descendants. It creates/reuses email-code sign-in and grants only the exact manager emails you supplied. The app independently validates their signed identity. The public wall stays public. No temporary authentication bypass or test CAPTCHA key is installed.

Resources and runtime secrets are saved incrementally under `.openmemorial/` with owner-only permissions. Interrupted setup can resume. It refuses to overwrite an existing Worker with no saved ownership record, retarget a connected folder to another account/site, or edit a policy shared with other applications. If a resource exists but your state file is missing, restore the state rather than pointing setup at unrelated resources. New resource IDs are written to `.openmemorial/wrangler.jsonc`; do not edit the shared template with personal account IDs.

If you use a connected Cloudflare tool instead of an API token, follow the same plan and guards and create the same private state/configuration files. Do not claim the CLI ran if you used another tool, and never put an account token into Worker bindings.

## 4. Publish after reviewing

```sh
npm run setup:cloudflare -- publish --apply
```

Publishing runs the type check and build, applies additive database migrations to the selected memorial database, deploys with the private runtime secret file, and checks the public wall, API configuration, and protected family endpoint. A successful build alone is not reported as a live website.

Visit the printed site address, then sign in at `/login` with an invited family email and the emailed code. Finally, submit a real text memory, verify that it stays private, approve it, and check that it becomes visible. Setup does not send test memories, read anyone’s inbox, or claim it has completed the human sign-in check.

Repeat the public checks anytime:

```sh
npm run setup:cloudflare -- verify
```

If a live check fails, setup reports it and retains its state; it does not claim success or delete resources. Provider DNS/Access propagation may require retrying verification.

## Add or remove a family manager

Update `managers` in your local answers file, then run local setup, connect, doctor, and publish again. This synchronizes the Access policy and the app’s independent allowlist. Removing an address from Access denies new protected requests; the updated app allowlist takes effect once deployed. Existing audit entries retain the original reviewer identity. The free starter does not send review-notification emails: family members check `/family` for waiting memories. Email sign-in codes are provided by Cloudflare Access.

## Optional uploads, notifications, and domains

The original application also supports visitor photo uploads using private R2 and the Images binding, and optional review emails. These are deliberately excluded from the free installer. [config/wrangler.uploads.jsonc](config/wrangler.uploads.jsonc) is a separate example for operators who explicitly choose those services; it contains placeholders and is not a ready-to-publish personal configuration. Check current billing terms first. See [MODERATION.md](MODERATION.md) for security requirements. Do not replace a working existing installation with the free config without reconciling its data and bindings.

A custom domain is optional and usually has a registration/renewal cost. Adding one later also requires updating Turnstile hostnames, Access application domains, the app’s allowed hostname, social metadata, and deployment checks. The automated free installer currently manages only the `workers.dev` hostname; do not assume a new domain is protected until verified.

## Deploy button / technical fallback

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/brennandecker/openmemorial)

The button deploys a **blank, read-only starter**. Cloudflare provisions D1 from the root configuration and runs its migrations by binding name. Sharing stays disabled until family approval and bot verification are configured. Review the repository visibility in Cloudflare’s Git flow before adding family content. The guided setup above is the path for a personalized memorial; the button does not bypass account setup or create a finished memorial automatically.

For an already configured operator-managed deployment, `npm run deploy` builds, migrates `NOTES`, and deploys the root Wrangler configuration. The guided installer uses its isolated private configuration instead. Runtime types are generated from the optional-services superset with `npm run types`; capability checks decide which bindings exist in an actual deployment. Run `npm test`, `npm run build`, and `wrangler deploy --dry-run` after code changes.
