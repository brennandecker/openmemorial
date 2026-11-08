# OpenMemorial

**A place for photographs, memories, and the people who mattered.**

Create a memorial website your family can own. Bring together photographs and stories, let visitors share memories, and give trusted family members control over what appears. OpenMemorial is free, open-source software you can personalize and host in your own account.

[![Checks](https://github.com/brennandecker/openmemorial/actions/workflows/ci.yml/badge.svg)](https://github.com/brennandecker/openmemorial/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-75654b.svg)](LICENSE)

![An illustrated scrapbook wall with photographs and a handwritten memory on warm paper.](docs/assets/memorial-wall.svg)

**[Create a memorial →](START_HERE.md)** · [Read the setup guide](SETUP.md) · [For developers](#for-developers)

## A wall that grows with your memories

Photographs become a scrapbook you can explore on a phone or a larger screen. Names appear on the front; dates, places, and optional notes belong on the back. Open a photograph full screen, find the people or years you remember, or play a slideshow of your selection.

- **Keep the details.** Add people, locations, and dates—even when you know only the year or month. Camera dates are suggestions for you to confirm.
- **Find a moment.** Filter by photos, videos, or notes; choose a year range; select multiple people and places.
- **Welcome memories.** Visitors can leave a written memory without creating an account. Every submission waits privately for family approval.
- **Keep family in control.** Invited managers can approve, decline, edit, hide, and restore content from a private dashboard. Changes have a review history.
- **Make it personal.** Choose the name, life dates, header photograph, photographs, and words. The template starts empty, ready for your family’s content.

Visitor photo submissions are also supported as an [optional extension](#optional-features), separate from the free starter.

## Create your memorial

### If you don’t write code

Start with **[the guided introduction](START_HERE.md)**. You can work through it with someone you trust, or with an assistant such as ChatGPT or Claude that can edit files and run commands. You bring the photographs and decisions; the guide explains the setup.

You will need a computer, a GitHub account for your private copy, and a Cloudflare account when you are ready to publish. Account setup and publishing still require a few technical steps; an assistant or a technical helper can walk through them with you.

To begin with an assistant, give it this repository and copy this prompt:

> Help me create a memorial using OpenMemorial: https://github.com/brennandecker/openmemorial. Read START_HERE.md and follow SETUP.md. Ask one question at a time, let me skip optional details, save my progress, and show me a local preview early. Use the free Cloudflare setup. Keep credentials private, and wait for me to review the memorial before publishing.

A chat-only assistant can help you prepare, but needs you or another tool to run the setup. The published memorial works independently of any AI service.

### What the process looks like

1. **Make your own private copy.** [Use this template](https://github.com/new?template_name=openmemorial&template_owner=brennandecker), choose **Private**, and keep family content in that copy.
2. **Tell the story.** Add a name, photographs, a public privacy contact, and the family members who can manage the wall. Optional details can wait.
3. **Review a preview.** Check the photographs, captions, dates, and policy pages before anything goes live.
4. **Connect and publish.** Follow the guided Cloudflare setup, then check the live wall, family sign-in, and approval flow.

**[Start here →](START_HERE.md)** The [full setup guide](SETUP.md) covers each step, including returning later to finish or make changes.

## What “free” means

**The application code is free under the [MIT license](LICENSE).** OpenMemorial charges no software subscription or license fee. No paid AI account, AI API, or proprietary site builder is required to run a memorial.

The default setup is designed around Cloudflare’s free plans:

| Included in the free starter | How it works |
| --- | --- |
| A public memorial wall | Runs in your own Cloudflare account. |
| Family photographs | Prepared on your computer and included with the site. |
| Written visitor memories | Stored privately until a family manager approves them. |
| Family sign-in and moderation | Email-code sign-in, exact invited emails, and a private review history. |
| Bot verification | Checks public submissions before accepting them. |
| A website address | Uses the included `workers.dev` address. |

Cloudflare’s free-plan limits still apply, and provider terms can change. **Free software does not mean unlimited hosting.** The installer does not buy a domain, upgrade a plan, or enable optional paid services. See **[hosting limits and optional costs](COSTS.md)** before publishing.

### Optional features

Operators can separately configure **one photo per visitor memory**, **review-notification emails**, and **a custom domain**. These require additional services or configuration and may incur costs. They are off in the free starter; family managers check their dashboard for waiting memories.

See [optional setup](SETUP.md#optional-uploads-notifications-and-domains) and [moderation and storage details](MODERATION.md). The included [upload configuration](config/wrangler.uploads.jsonc) is an example with placeholders, not a finished deployment.

## Family approval, built in

**A visitor’s memory is never published automatically.** It enters a private waiting queue. An invited family manager signs in, reviews it, and decides whether to publish it.

From `/family`, managers can work with both visitor memories and the original wall: correct names or dates, edit text, hide a card, and restore earlier details. Review history records who changed what and when. Declined memories remain privately recoverable for at least 60 days; there is currently no automatic purge.

The guided setup processes family photographs locally and removes embedded metadata from the display copies. It keeps the originals on your computer. Manager email addresses and credentials stay outside public frontend files. A public privacy/removal contact and adaptable privacy and terms pages are included.

Keep your originals and back up the site’s database separately. A copy of the GitHub repository does **not** contain visitor submissions or moderation history. [Read about approval, privacy, and recovery →](MODERATION.md)

## For developers

OpenMemorial uses **React, TypeScript, Vite, and Cloudflare Workers**. D1 stores visitor memories and family edits; Access protects family sign-in; Turnstile checks submissions. The guided free setup bundles photographs as static assets. Optional visitor uploads use private R2 storage and the Images binding.

### Run locally

With **Node.js 22.13 or later**, clone your private copy and run:

```sh
npm ci
npm run setup
npm run dev
```

Setup asks for memorial details, prepares photographs, and saves private progress under ignored `.openmemorial/`. It does not publish. The Vite preview shows the frontend; public posting and family review require the configured Worker backend.

For a non-interactive setup, prepare a private answers file from [memorial.example.json](memorial.example.json). See [SETUP.md](SETUP.md) for fields, photo processing, and account permissions.

### Connect, check, and publish

After completing the account and credential steps in [SETUP.md](SETUP.md):

```sh
npm run setup:cloudflare -- plan
npm run setup:cloudflare -- connect --apply
npm run doctor -- --remote
npm run setup:cloudflare -- publish --apply
npm run setup:cloudflare -- verify
```

The connector saves progress so interrupted setup can resume. Checks cover the account and site target, family access, bot verification, and exclusion of optional services. Publishing builds the app, applies database migrations, deploys, and checks live endpoints. Complete the family email-code sign-in and a real approval cycle yourself before handing over the site.

Keep API tokens in the process environment and `.openmemorial/` private. Preserve stable media IDs when updating an existing wall. Existing installations should reconcile their data and bindings before adopting a different deployment configuration.

<details>
<summary>Deploy a blank starter instead</summary>

<br>

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/brennandecker/openmemorial)

This deploys a **blank, read-only starter**. It does not personalize the site or finish account onboarding. Sharing stays disabled until family approval and bot verification are configured. Use the [guided setup](SETUP.md) for a personalized memorial, and check repository visibility before adding family content.

</details>

### Find your way around

| You want to… | Go to… |
| --- | --- |
| Help a family get started | [START_HERE.md](START_HERE.md) |
| Configure or publish a memorial | [SETUP.md](SETUP.md) |
| Understand free plans and optional costs | [COSTS.md](COSTS.md) |
| Understand approval, uploads, and recovery | [MODERATION.md](MODERATION.md) |
| Change memorial content and photo metadata | [memorial.ts](src/memorial.ts), [photoWallData.ts](src/photoWallData.ts), [wallNotes.ts](src/wallNotes.ts) |
| Work on onboarding and deployment | [setup scripts](scripts/setup/), [Cloudflare connector](scripts/cloudflare.mjs) |
| Change the app or contribute a fix | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Report a security issue privately | [SECURITY.md](SECURITY.md) |

Run `npm test` and `npm run build` before contributing code. GitHub Actions runs those checks on pushes and pull requests; it does not deploy memorials or require production secrets. Backend tests use isolated data and simulated authentication. See [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md) for assistant instructions.

## Contribute

Help is welcome with accessibility, clearer instructions, testing the setup, and focused improvements. You do not have to write code to point out a confusing step or suggest better wording. [Open an issue](https://github.com/brennandecker/openmemorial/issues) using example data; report vulnerabilities through the [private security channel](SECURITY.md).

Keep real family photographs, visitor memories, private email addresses, and credentials out of public issues and pull requests. Read the [contribution guide](CONTRIBUTING.md) before making a change.

## Yours to keep

The [MIT license](LICENSE) covers the application code. Photographs, tributes, and other memorial content belong to their respective owners; the code license does not grant permission to reuse them.

Your memorial lives in your own account, with source code you can keep and change. Start with a few photographs. Add the rest when you are ready.
