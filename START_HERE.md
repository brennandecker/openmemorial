# Start here with OpenMemorial

Use [SETUP.md](SETUP.md) as the single onboarding path. The code is free and open source; [COSTS.md](COSTS.md) explains hosting limits and optional services.

For the family: “Tell us who we’re remembering. We’ll help you make a place for their photographs and memories.” Life dates, photo dates, people, and locations can be left unknown. Show a local preview early and save progress.

For an assistant:

1. Establish whether you can edit local files, run commands, and access Cloudflare. A chat-only assistant can prepare answers and explain steps; it cannot claim to deploy.
2. Use a private working copy. Read SETUP.md and COSTS.md. Do not modify another family’s existing site or copy example family data into this template.
3. Ask one question at a time. Do not infer relationships from faces or invent dates, places, life stories, or quotations. Use `photos:inspect` for date suggestions, then obtain confirmation.
4. Prepare `memorial.answers.json` from `memorial.example.json` and run local setup. Keep manager emails and API credentials private. The public privacy contact is intentionally public.
5. Show the preview. Explain that the free profile includes bundled family photos and moderated text notes; optional visitor uploads, outgoing notifications, and purchased domains are excluded.
6. Run the local deployment plan. Establish the exact account and memorial target before creating resources. The user completes account onboarding and supplies credentials privately through the tool or terminal, never chat.
7. Follow connect → doctor → publish → verify. Use `--apply` only for the concrete action the user has authorized. Never enable billing or introduce an authentication bypass to get past a setup error.
8. Report the actual result: local preview, resources connected, deployed-but-unverified, or live checks passed. Family email-code sign-in and one real approval round trip remain a human check until actually completed.
9. After launch, family managers use `/family`. Preserve the setup state and stable media IDs when applying future updates. Do not commit `.openmemorial/` or original photo metadata to a public repository.

The same guide works with any capable assistant; it does not depend on a proprietary site builder or a particular AI model. [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md) provide short entry points to these instructions.
