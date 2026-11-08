# OpenMemorial assistant instructions

Read START_HERE.md and SETUP.md for onboarding. Read COSTS.md before proposing hosting or enabling optional services. Use the free profile by default. Ask before publishing a reviewed memorial or enabling third-party billing. Never ask for credentials in chat, invent family details, bypass approval/authentication, or put manager emails in public frontend files.

Development: Node 22.13+, `npm ci`, `npm test`, `npm run build`. The default configuration is a read-only starter with optional visitor notes enabled by the setup command only after authentication and bot checks are ready. Do not run remote setup or deploy commands as a test. Use local temporary directories and mocked API calls. Runtime types come from `npm run types` (the optional-services configuration superset). Shared application changes must preserve existing moderation and recoverability behavior.
