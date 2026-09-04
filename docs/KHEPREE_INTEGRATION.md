# Khepree licensing integration

This client follows the same security model documented by Khepree Novel AI / DESKTOP-INTEGRATION.

Production endpoints:

- API: `https://api.khepree.com/api/v1`
- Account: `https://account.khepree.com`
- Authorize: `https://account.khepree.com/desktop/authorize`
- Product page: `https://khepree.com/vi/products/khepree-livestream-ai`

## Registered identity (must match platform catalog)

| Field | Value |
|-------|-------|
| product slug | `khepree-livestream-ai` |
| desktop client id | `khepree-livestream-ai-desktop` |
| redirect URI | `khepreelivestreamai://auth/callback` |
| access feature | `livestream_ai.access` |

Source of truth in this repo: `src/shared/khepree-catalog.ts`.

## Commercial plans (catalog)

| Plan slug | Price | Term | Internal code |
|-----------|-------|------|---------------|
| `trial` | free | 1 day | `LIVESTREAM_AI_FREE_TRIAL` |
| `month` | 299.000 VND | 30 days | `LIVESTREAM_AI_MONTHLY` |
| `year` | 2.799.000 VND | 365 days | `LIVESTREAM_AI_YEARLY` |

Paid plans are purchased via `POST /desktop/checkout` → browser handoff. Free trial has no price row, so it does not appear in `/desktop/plans` (grant via catalog/account ops if needed).

## Expected desktop flow

1. Generate installation UUID and Ed25519 device key pair.
2. Generate PKCE verifier/challenge and random `state`.
3. Open Khepree account authorize URL in system browser.
4. Receive custom protocol callback.
5. Exchange code at `/desktop/auth/exchange` (unwrap `{ data }`).
6. Store refresh token encrypted; access token stays memory-only.
7. Activate device at `/desktop/activate` when entitlement exists.
8. Load `/desktop/me`; list `/desktop/plans?clientId=...` when checkout is needed.
9. Verify signed lease locally against pinned Ed25519 public key (required when packaged).
10. Only `ACTIVE` + `livestream_ai.access` unlocks protected livestream operations.
11. Heartbeat while active; revocation pauses protected actions.
12. Checkout: `POST /desktop/checkout` → open `handoffUrl` → poll status if needed.

## Integration note

Khepree catalog + `desktop_clients` registration lives in the platform repo:

- seed: `packages/db/src/seed/index.ts` (`pnpm db:seed`)
- production SQL: `scripts/register-livestream-ai-desktop-client.sql`

This foundation intentionally does not invent a production signing key — set `KHEPREE_LICENSE_SIGNING_PUBLIC_KEY` before packaged verification.

In a workspace where `@khepree/sdk` is available, replace local contract types in `src/shared/khepree-contracts.ts` with imports from the SDK.
