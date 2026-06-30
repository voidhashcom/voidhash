# Server-First Schema — Backend Implementation Spec

Status: Draft
Owner: Backend (consumed by CLI + React Native SDK)
Tracks: server-side work required by the
`feat/move-to-server-first` redesign of the CLI and `@voidhash/react-native`.

## Context

The CLI and React Native SDK no longer treat the user's code as the source of
truth for the schema (perks, products, paywall locations, payment provider
mappings). The dashboard is. After the client-side refactor:

- `voidhash-cli schema push / pull / check` are gone.
- The CLI's only job vs the schema is to generate a `.d.ts` declaration file
  (`voidhash.gen.d.ts`) consumed by the SDK via module augmentation.
- The SDK fetches the runtime schema on `Provider` mount instead of receiving
  it via code.
- The CLI watches for schema changes and the dev-mode SDK warns when the
  generated file is stale.

This document specifies the **server-side** endpoints and contracts that make
that operational. None of this exists today — the client side has stubs / falls
back to existing per-entity endpoints in the meantime.

The shapes referenced below come from:

- `apps/cli/src/domain/schema/normalized-schema.ts` — `NormalizedSchema`
  (what the CLI generates the `.d.ts` from).
- `libraries/react-native/src/core/schema/runtime.ts` — `RuntimeSchema`
  (what the SDK consumes at runtime).
- `apps/cli/src/utils/schema/version.ts` —
  `computeSchemaVersionFromNormalized` (the deterministic hash that both
  client and server must agree on).

## Endpoints

Three new things to ship. Existing per-entity endpoints
(`/api/v1/perks`, `/api/v1/products`, `/api/v1/paywall-locations`,
`/api/v1/payment-provider-configurations`,
`/api/v1/payment-provider-products`, `/api/v1/product-perks/by-product-id/{productId}`)
can stay; the new endpoints are additive.

### 1. `GET /api/v1/schema` — consolidated read (CLI-facing)

Replaces the five round-trips the CLI currently makes to assemble a
`NormalizedSchema`. Returns everything in one response.

**Authentication:** Bearer token (session). Same auth as today's per-entity
admin endpoints. The CLI calls this from `voidhash-cli types generate` (and
indirectly from `voidhash-cli init`).

**Response (200):**

```jsonc
{
  "version": "sha256:<hex>", // identical to GET /schema/version below
  "perks": [{ "slug": "all-access", "name": "All Access" }],
  "locations": [{ "slug": "home", "name": "Home", "description": null }],
  "products": [
    {
      "slug": "monthly_sub",
      "name": "Monthly",
      "type": "subscription",
      "perks": ["all-access"], // perk slugs, not IDs
      "providers": [
        {
          "providerId": "appleAppStore",
          "configuration": { "productId": "com.app.monthly" },
        },
        {
          "providerId": "googlePlay",
          "configuration": {
            "productId": "com.app.monthly",
            "basePlanId": "monthly-base",
          },
        },
      ],
    },
  ],
  "enabledProviders": ["appleAppStore", "googlePlay"],
}
```

**Field-by-field mapping** to the CLI's `NormalizedSchema` (which is the
intermediate the codegen runs over):

| Server field         | CLI shape (`NormalizedSchema`)                          | Notes                                                                                                                                                  |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `perks[]`            | `Map<slug, { slug, name }>`                             |                                                                                                                                                        |
| `locations[]`        | `Map<slug, { slug, name, description }>`                | `description` is `null` when unset.                                                                                                                    |
| `products[]`         | `Map<slug, { slug, name, type, perks[], providers[] }>` | `perks` is an array of perk **slugs**. `providers[].configuration` is provider-shaped. `type` is currently always `"subscription"` (extensible later). |
| `enabledProviders[]` | `Set<ProviderId>`                                       | `"appleAppStore"` / `"googlePlay"`. Other provider IDs are filtered out client-side; sending them is harmless.                                         |
| `version`            | derived (see hash spec below)                           | Must equal `GET /schema/version`.                                                                                                                      |

**Caching:** Should set `ETag: "<version>"` and respect
`If-None-Match` → return 304 when the client's known version matches.
The CLI watch loop relies on this being cheap.

**Errors:** Standard auth / not-found responses. An empty project (zero
perks/products/locations) returns 200 with empty arrays and a deterministic
version hash (see below).

### 2. `GET /api/v1/schema/version` — cheap version probe

Returns just the version hash. Used by:

- `voidhash-cli types generate --watch` (polls every 5s by default).
- `voidhash-cli types check` (CI gate — compares against the `@voidhash:version`
  header in the local `.d.ts`).
- The SDK's dev-mode drift warning.

**Authentication:** Bearer token (session) **OR** publishable key.
The CLI uses session auth. The SDK uses the publishable key it already
sends on every other request (`x-publishable-key` header). The endpoint
needs to accept both so we don't need two near-identical routes.

**Response (200):**

```json
{ "version": "sha256:<hex>" }
```

Must equal the `version` field of `GET /api/v1/schema`.

**Caching:** Same `ETag` / `If-None-Match` story; 304 on match. Strongly
prefer keeping this under ~200 bytes uncompressed.

### 3. `GET /sdk/schema` — runtime schema for the SDK

The SDK calls this on `Provider` mount to populate `RuntimeSchema`, which
drives `useProducts`, native store lookups (slug → provider productId), etc.

**Authentication:** Publishable key (`x-publishable-key` header, matching
existing `/api/v1/sdk/*` endpoints). The CLI does **not** call this — it
uses `GET /api/v1/schema`.

**Response (200):**

```jsonc
{
  "version": "sha256:<hex>",
  "perks": {
    "all-access": { "slug": "all-access", "name": "All Access" },
  },
  "locations": {
    "home": { "slug": "home", "name": "Home", "description": null },
  },
  "products": {
    "monthly_sub": {
      "slug": "monthly_sub",
      "type": "subscription",
      "properties": { "name": "Monthly" },
      "configuration": {
        "perks": { "all-access": true },
        "providers": {
          "appleAppStore": { "productId": "com.app.monthly" },
          "googlePlay": {
            "productId": "com.app.monthly",
            "basePlanId": "monthly-base",
          },
        },
      },
    },
  },
}
```

This is exactly `RuntimeSchema` from
`libraries/react-native/src/core/schema/runtime.ts`. Note the differences
from `GET /api/v1/schema`:

- Object-keyed by slug (not arrays of objects). The SDK looks products up
  by slug at runtime.
- Per product, `properties: { name }` and
  `configuration: { perks, providers }` are split (matches the SDK's
  existing internal shape — minimizes the diff vs the old DSL-built
  product definitions).
- `enabledProviders` is **not** required (the SDK doesn't need it; only the
  CLI codegen does).

The server should be able to derive this from the same underlying records
that back `GET /api/v1/schema` — it's a different projection of the same
data.

### 4. Slug-accepting endpoint variants

Today the SDK passes server-issued IDs to:

- `POST /api/v1/sdk/sync-transaction` — `payload.productId`
- `POST /api/v1/sdk/resolve-paywall` — `payload.locationSlug` (already a
  slug; verify no other ID fields are needed)
- Any internal lookups during purchase/restore that travel through
  `/api/v1/sdk/*`

After the redesign the SDK no longer ships a slug → ID map. **Every SDK
endpoint that today accepts an entity ID must accept the corresponding
slug as a substitute.** Two acceptable patterns:

- Replace the field type from "ID" to "slug or ID" with the server
  resolving either form. Simplest; keeps a single field name.
- Add a parallel `*Slug` field and deprecate the `*Id` variant.

Pick whichever your typed HTTP framework prefers. The SDK will only emit
slugs going forward; the ID variants only need to remain alive long enough
to drain in-flight clients (probably one or two release cycles).

Affected endpoints to audit (non-exhaustive — please confirm against the
current code):

- `POST /api/v1/sdk/sync-transaction` — `productId`
- `POST /api/v1/sdk/resolve-paywall` — confirm whether the body or any
  resolved sub-objects carry IDs the client would need to round-trip
- Any future purchase / checkout endpoints

The CLI does not need slug variants — it operates against IDs as today.

## Version hash algorithm

The hash is the single point of agreement between client and server. The
CLI computes it from a `NormalizedSchema` in
`apps/cli/src/utils/schema/version.ts`. The server **must** produce the
same bytes from the same logical schema, otherwise `types check` will
ping-pong between "stale" and "fresh" depending on who computed last.

Algorithm:

1. Build a JSON object with three top-level keys, **in this exact order**:
   `locations`, `perks`, `products`.
2. Each is an array, sorted ascending by `slug`.
3. Per-element field order matches the CLI emit (see below).
4. Stable JSON stringification: no whitespace, no trailing keys, exact
   field order as written. (Node's `JSON.stringify` with explicit object
   construction in declared order is what the CLI does.)
5. `sha256` the resulting UTF-8 bytes, hex-encode, prefix with `sha256:`.

Reference: `apps/cli/src/utils/schema/version.ts` —
`computeSchemaVersionFromNormalized`. The exact source order:

```js
// products[i]
{ name, perks: [sorted slugs], providers: [{providerId, configuration} sorted by providerId], slug, type }

// locations[i]
{ description, name, slug }

// perks[i]
{ name, slug }
```

The `configuration` field per provider is whatever object was stored — its
internal property order matters. Two safe options:

- Store provider configurations canonically (sort keys at write time).
- Re-canonicalize at read time before hashing.

Whichever you pick, the CLI just round-trips whatever the server sent in
its `providers[].configuration`. As long as **the server hashes the same
bytes it sends in `GET /api/v1/schema`**, the client side will match by
construction (the CLI just JSON-serializes what it received).

An empty schema produces a deterministic hash:

```
sha256:<sha256({"locations":[],"perks":[],"products":[]})>
```

## Authentication summary

| Endpoint                     | Session bearer | Publishable key |
| ---------------------------- | :------------: | :-------------: |
| `GET /api/v1/schema`         |       ✅       |       ❌        |
| `GET /api/v1/schema/version` |       ✅       |       ✅        |
| `GET /sdk/schema`            |       ❌       |       ✅        |
| Slug-accepting `/sdk/*`      |       ❌       |       ✅        |

`GET /api/v1/schema/version` accepts both because the CLI uses it during
`types generate --watch` and the SDK uses it for the dev-mode drift
warning.

## Caching & freshness

- All three GETs should set `Cache-Control: no-cache, must-revalidate` and
  `ETag: "<version>"`.
- 304 on `If-None-Match` match. The CLI watch loop and the dev-mode SDK
  warning will both benefit (cheap polls, no payload on no-change).
- Don't set a positive max-age — the whole point is that we want clients
  to revalidate eagerly. The cache savings come from 304s, not from
  skipping the round trip.

## Empty / unconfigured projects

A freshly-`init`ed project has zero perks/products/locations. The
endpoints should still return 200 with empty collections and a deterministic
hash (see "Empty schema" above). The CLI / SDK already handle this
gracefully — `voidhash.gen.d.ts` lists `products: never`, and the
SDK-side conditional types in
`libraries/react-native/src/core/schema/registry.ts` degrade `never` back
to `string` so user code still compiles.

## Out of scope for this spec

- Schema mutation endpoints. The dashboard already exposes them today; no
  changes needed.
- Versioning of the schema itself (migrations, snapshots, history). The
  `sha256:` is a content hash, not a logical version number. If we want
  per-revision history later, that's an additive feature.
- Webhook on schema change. Out of scope for v1 of the server-first
  redesign — the CLI's polling against `/schema/version` is intentionally
  the v1 freshness mechanism (Combo A + B in the design doc).

## Sequencing recommendation

1. **`GET /api/v1/schema/version`** first. It's the smallest piece of
   surface area and unblocks both the CLI watch loop and the dev-mode SDK
   drift warning. Until it ships, `types check` falls back to a full
   schema fetch (already implemented client-side in `fetchSchemaVersion`).
2. **`GET /api/v1/schema`** second. The CLI already composes today's
   per-entity endpoints to produce the same `NormalizedSchema`, so this
   is purely an optimization (1 round-trip vs 5+). No client changes
   needed when it lands — the CLI's `fetchRemoteSchema` can be swapped
   internally to use the new endpoint.
3. **`GET /sdk/schema`** third. Unblocks runtime product hooks
   (`useProducts`, `usePurchase`) in the SDK. Until it ships,
   `apiClient.sdk.getSchema()` returns an empty schema with a warning
   (see the stub in `libraries/react-native/src/core/networking/api-client.ts`).
4. **Slug-accepting `/sdk/*` variants** last. The SDK doesn't need them
   to function in the "products fetched via `GET /sdk/schema`" path — it
   still has the provider productIds — but they let us drop the
   provider-productId fields from the bundle if/when we decide
   schema-on-bundle was wrong. Out of the critical path for v1.

## Verification (server-side)

1. Round-trip `GET /api/v1/schema` and run the result through the CLI's
   `computeSchemaVersionFromNormalized` helper. The result must equal the
   `version` field in the response and the response of
   `GET /api/v1/schema/version`.
2. Mutate the schema (add a perk), assert `GET /schema/version` changes,
   `If-None-Match: <old-version>` returns 304 before the mutation and 200
   after.
3. From a fresh CLI clone with a generated `voidhash.gen.d.ts` for the
   pre-mutation schema, run `voidhash-cli types check` — assert non-zero
   exit + the printed diff cites the new version.
4. From the SDK example app, mount `Provider`, assert `useProducts()`
   returns the slugs/configurations now living on the server.

## Open questions for the backend team

- Should `GET /sdk/schema` be rate-limited per publishable key? The SDK
  calls it once per session; a misbehaving app could call it more
  aggressively.
- Do we want the dashboard to invalidate ETags eagerly on edit, or rely
  on the natural propagation? (Either works; ETag invalidation is purely
  a latency optimization.)
- Provider-configuration shape stability: are we comfortable hashing the
  raw `configuration` object, or do we want to canonicalize per-provider
  to insulate against accidental key reorderings? Current proposal is
  "hash what you send" which is the simplest contract.
