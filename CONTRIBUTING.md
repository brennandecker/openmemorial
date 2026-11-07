# Contributing to OpenMemorial

OpenMemorial helps families maintain personal memorial websites they own and can host themselves. Please keep contributions calm, accessible, respectful, and easy to maintain.

## Development

Use Node 22.13 or newer. Run `npm ci`, then `npm run dev`. Before opening a pull request, run `npm test` and `npm run build`. Backend tests use isolated local databases and simulated authentication and bot verification; they never need production credentials.

Describe the problem and the resulting behavior in your pull request. Include screenshots for visible changes and relevant validation. Keep changes focused. Preserve keyboard navigation, screen-reader labels, reduced-motion behavior, and usable phone layouts.

## Content and privacy

Use synthetic names, photos you have permission to share, and local test data. Never commit family photographs, visitor submissions, review histories, private email addresses, tokens, `.env` files, or database exports. Do not use a real memorial as a test database.

All visitor memories must remain private until an authorized reviewer approves them. Authentication checks must fail closed. Do not introduce production test keys or bypasses for local development.

## Licensing

Contributions to the application code are made under the repository's MIT license. Memorial content remains the property of its respective owners. Third-party assets must include their license and attribution.
