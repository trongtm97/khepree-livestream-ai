# Khepree licensing integration

This client follows the same security model documented by Khepree Novel AI.

Production endpoints:

- API: `https://api.khepree.com/api/v1`
- Account: `https://account.khepree.com`
- Authorize: `https://account.khepree.com/desktop/authorize`

Recommended product registration:

- product slug: `khepree-livestream-ai`
- desktop client id: `khepree-livestream-ai-desktop`
- redirect URI: `khepreelivestreamai://auth/callback`

## Expected desktop flow

1. Generate installation UUID and Ed25519 device key pair.
2. Generate PKCE verifier/challenge and random `state`.
3. Open Khepree account authorize URL in system browser.
4. Receive custom protocol callback.
5. Exchange code at `/desktop/auth/exchange`.
6. Store refresh token encrypted; access token stays memory-only.
7. Activate device if necessary at `/desktop/activate`.
8. Load `/desktop/me`.
9. Verify signed lease locally against pinned Ed25519 public key.
10. Only `ACTIVE` unlocks protected livestream operations.
11. Heartbeat while active; revocation pauses protected actions.

## Integration note

The exact server-side desktop client/product must be created in the Khepree monorepo/admin data. This foundation intentionally does not invent a production signing key.

In a workspace where `@khepree/sdk` is available, replace local contract types in `src/shared/khepree-contracts.ts` with imports from the SDK.
