# Free software and hosting costs

OpenMemorial’s application code is MIT licensed. There is no OpenMemorial license fee, required paid AI account, subscription to a site builder, or AI API call in the running memorial.

The **free starter** is designed for Cloudflare Workers Free, Workers Static Assets, D1 Free, Turnstile Free, Cloudflare Access Free, and an included `workers.dev` address. Family photographs are prepared locally and bundled as static site assets. Visitor contributions in this profile are text notes, held privately until approval. Sign-in codes use Access; outbound review notifications and visitor photo uploads are off.

This does not promise unlimited hosting or that a provider will keep its plans unchanged forever. Cloudflare’s account-level quotas apply across the account, including its other projects. Reaching a free-plan limit may interrupt posting or availability. The installer never upgrades a plan, adds billing subscriptions, or purchases a domain. If your account is already on a paid plan, these scripts cannot make that account’s existing billing disappear.

Checked November 8, 2026. Verify provider terms before enabling optional services:

| Service | Starter use | Cost consideration |
| --- | --- | --- |
| [Workers](https://developers.cloudflare.com/workers/platform/pricing/) | Server endpoints and static assets | Free-plan request/CPU limits apply. Static asset delivery has separate pricing rules. |
| [D1](https://developers.cloudflare.com/d1/platform/pricing/) | Notes, approval, private history | Daily reads/writes and storage limits apply. On Free, exceeding limits can cause failures rather than automatic paid capacity. |
| [Turnstile](https://developers.cloudflare.com/turnstile/plans/) | Bot checks on submissions | Use the Free plan and production keys for the exact site hostname. |
| [Access](https://www.cloudflare.com/zero-trust/products/access/) | Family email-code sign-in | Choose the Free plan and remain within its seat allowance. Initial provider onboarding may require account/plan details. |
| [R2](https://developers.cloudflare.com/r2/get-started/) | **Not enabled** | Requires subscription checkout. Included monthly usage is not an unlimited, no-billing guarantee. |
| [Images](https://developers.cloudflare.com/images/pricing/) | **Not enabled** | Transformation and hosted-image plans differ. Check current allowances before enabling visitor uploads. |
| [Email Service](https://developers.cloudflare.com/email-service/platform/pricing/) | **Not enabled** | Sending eligibility, verified recipients, domain setup, and plan limits apply. |
| Custom domain | **Not required** | Registration and renewal generally cost money. Use the supplied address to avoid this purchase. |

Back up your family originals and private setup state. Database backups and source-code archives are different: GitHub code backups do not preserve visitor submissions or moderation history. Free services are not a substitute for a family-owned copy of important photographs and memories.
