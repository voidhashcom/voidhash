# Paywalls MVP — Server Protocol Spec

This document specifies the backend Voidhash must implement so the paywall system
(`@voidhash/paywalls`, the Studio, and the `voidhash-cli deploy`/`studio`
commands) integrates end-to-end. It is the contract between three actors:

| Actor                                     | Role                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| **CLI** (`voidhash-cli deploy`)           | Builds paywalls and **uploads** the deploy payload.                                     |
| **Server** (this spec)                    | Stores deploys, serves the live paywall to devices, resolves placements + entitlements. |
| **Device SDK** (`@voidhash/react-native`) | Presents a paywall in a WebView, **injects** runtime config, handles the **bridge**.    |

The client side is implemented today. Everything marked **[server]** is what this
task hands off; everything marked **[done]** already exists in this repo and the
server must remain compatible with it.

> **Source of truth for shapes.** The TypeScript contracts referenced here are
> real and version-locked:
>
> - Deploy payload: [`apps/cli/src/domain/schema/paywall-deploy.ts`](apps/cli/src/domain/schema/paywall-deploy.ts) (`DeployManifest`, `schemaVersion: 1`).
> - Runtime config: [`libraries/paywalls/src/runtime/config.ts`](libraries/paywalls/src/runtime/config.ts) (`PaywallRuntimeConfig`).
> - Bridge protocol: [`libraries/paywalls/src/runtime/bridge.ts`](libraries/paywalls/src/runtime/bridge.ts) (`PaywallOutboundMessage`, `PaywallInboundMessage`).
>   The server MUST keep these in sync; bump `schemaVersion` on any breaking change.

---

## 1. Concepts & glossary

- **Paywall** — a code-driven screen authored in `.voidhash/paywalls/<id>.tsx`.
  Compiles to a self-contained HTML+JS bundle.
- **Component** — a reusable piece in `.voidhash/components/<id>.tsx`. Not served
  standalone; shipped as raw source only (for the future GUI builder + diffing).
- **Asset** — a binary (image/font) referenced by a paywall, content-addressed.
- **Deploy** — one immutable upload of all paywalls/components/assets for a
  project, produced by `voidhash-cli deploy`.
- **Placement** (a.k.a. _location_) — a named slot in the app (e.g. `onboarding`,
  `settings_upgrade`) that the SDK presents. A placement is _assigned_ a paywall.
  This indirection is what lets customers swap paywalls without an app release.
- **Content hash** — lowercase hex SHA-256. Every file and every paywall has one;
  identical content ⇒ identical hash ⇒ dedupe + cache key.
- **Release / channel** — a pointer that maps placements → paywall versions for a
  given audience (e.g. `production`, `staging`). The device resolves through a
  channel, never directly to a deploy.

---

## 2. The full flow

```
 author .voidhash/*.tsx
          │  voidhash-cli deploy
          ▼
   ┌──────────────┐  POST /v1/paywalls/deploys (manifest + files)   ┌──────────┐
   │     CLI       │ ───────────────────────────────────────────▶  │  Server  │
   └──────────────┘  ◀─── 201 { deployId, missingFiles? }           └────┬─────┘
          │  PUT missing blobs (content-addressed)                       │ store deploy (immutable)
          │  POST .../finalize                                           │ assign placements (manual or auto)
          ▼                                                              ▼
   dashboard: assign placement → paywall, publish to a channel
          │
          ▼
   ┌──────────────┐  GET /v1/paywalls/resolve?placement=onboarding   ┌──────────┐
   │  Device SDK   │ ───────────────────────────────────────────────▶│  Server  │
   └──────┬───────┘  ◀── { url, contentHash, products, variables }    └──────────┘
          │  open WebView(url), inject window.__VOIDHASH_PAYWALL__
          │  bundle boots → renders paywall
          ▼
   user taps "Subscribe" → bridge postMessage → SDK runs StoreKit/Billing
          │  SDK pushes status back into the WebView
          ▼
   purchase complete → SDK dismisses paywall, unlocks entitlement
```

---

## 3. Deploy API **[server]**

The CLI today builds the payload and writes it to `.voidhash/.build/` with a
`manifest.json`; the upload call is the only missing piece (see the `// Upload`
block in [`apps/cli/src/cli/commands/deploy.ts`](apps/cli/src/cli/commands/deploy.ts)).
Implement the endpoints below; wiring the CLI to them is a one-function change.

### 3.1 Authentication

All deploy endpoints require a **secret** API key (`x-api-key: vh_sk_…`), the same
scheme the CLI already uses (see [`apps/cli/src/utils/api-client.ts`](apps/cli/src/utils/api-client.ts)).
The key authorizes a single `{team, project}`. Reject if `manifest.team` /
`manifest.project` don't match the key's scope (`403`).

### 3.2 Content-addressed upload (two-phase)

To avoid re-uploading unchanged bundles/assets on every deploy, uploads are
content-addressed and two-phase.

**Phase 1 — create the deploy.** The CLI POSTs the **manifest only**.

```
POST /v1/paywalls/deploys
Content-Type: application/json
x-api-key: vh_sk_…

<DeployManifest>            // exactly the manifest.json the CLI produced
```

The manifest lists every file with its `sha256`. The server responds with the
deploy id and the subset of hashes it does **not** already have stored:

```
201 Created
{
  "deployId": "dep_…",
  "missing": ["<sha256>", "<sha256>", …]   // upload only these
}
```

**Phase 2 — upload missing blobs.** For each missing hash, the CLI uploads the
raw bytes. Content-addressed, so the path is the hash:

```
PUT /v1/paywalls/deploys/dep_…/blobs/<sha256>
Content-Type: application/octet-stream
x-api-key: vh_sk_…

<raw bytes>
```

The server MUST verify `sha256(body) === <sha256>` and reject mismatches (`422`).
A blob already present returns `200`/`204` (idempotent).

**Finalize.** Once all blobs are present:

```
POST /v1/paywalls/deploys/dep_…/finalize
→ 200 { "deployId", "paywalls": [{ "id", "contentHash" }], "status": "ready" }
```

The server validates that every file referenced by the manifest now resolves to a
stored blob; if any are missing it returns `409 { missing: […] }`. Finalize is the
commit point — a deploy is **immutable** afterward.

> A simple server MAY accept the whole payload in one multipart request instead of
> the two-phase flow (see §3.4). The two-phase flow is recommended because most
> deploys change one paywall, so most blobs are already stored.

### 3.3 What's in the payload

The `DeployManifest` (schema v1) groups everything (paths are relative to the
project root, POSIX-separated):

```jsonc
{
  "schemaVersion": 1,
  "cliVersion": "0.0.1-alpha.1",
  "runtimeVersion": "0.0.1-alpha.1", // @voidhash/paywalls version built against
  "team": "voidhash-dev-sro",
  "project": "dev-proj",
  "createdAt": "2026-06-03T10:00:00.000Z",
  "paywalls": [
    {
      "id": "onboarding-green",
      "title": "Onboarding (Green)",
      "description": "Full-screen onboarding paywall with selectable plans.",
      "source": { "path": ".voidhash/paywalls/onboarding-green.tsx", "bytes": 4096, "sha256": "…" },
      "artifacts": {
        "html": {
          "path": ".voidhash/.build/onboarding-green/index.html",
          "bytes": 900,
          "sha256": "…",
          "contentType": "text/html; charset=utf-8",
        },
        "js": {
          "path": ".voidhash/.build/onboarding-green/bundle.js",
          "bytes": 201000,
          "sha256": "…",
          "contentType": "text/javascript; charset=utf-8",
        },
      },
      "assets": [".voidhash/.build/onboarding-green/assets/hero-AB12CD.png"],
      "contentHash": "5b00934c90ee…", // identity of the deployable paywall
    },
  ],
  "components": [
    {
      "id": "product-option",
      "source": { "path": ".voidhash/components/product-option.tsx", "bytes": 1500, "sha256": "…" },
    },
  ],
  "config": { "path": "voidhash.config.ts", "bytes": 120, "sha256": "…" },
  "assets": [
    {
      "path": ".voidhash/.build/onboarding-green/assets/hero-AB12CD.png",
      "bytes": 88000,
      "sha256": "…",
      "contentType": "image/png",
    },
  ],
}
```

Three classes of content, all in one deploy:

1. **Compiled artifacts** — `paywalls[].artifacts.html` + `.js`: the WebView-ready
   bundle (the paywall React tree + the DOM renderer + React, IIFE, minified,
   `NODE_ENV=production`, targeting `es2019`/`safari13`). This is what the device
   renders.
2. **Raw source** — `paywalls[].source`, `components[].source`, `config`: the
   author's `.tsx`/config. Stored for the future GUI builder, deploy diffing, and
   support. **Not** served to devices.
3. **Assets** — `assets[]`: binaries referenced by bundles, content-addressed.

### 3.4 Single-request fallback

For a minimal first server, accept `multipart/form-data` at
`POST /v1/paywalls/deploys` with one `manifest` part (JSON) and one part per file
keyed by its `sha256`. Server validates hashes and finalizes atomically. Same
result, fewer round-trips; lose the dedupe optimization.

### 3.5 `contentHash` semantics

`paywalls[].contentHash = sha256( sha256(html) : sha256(js) : sorted(asset hashes) )`
(see `buildPaywalls` in [`apps/cli/src/domain/services/paywall-build.ts`](apps/cli/src/domain/services/paywall-build.ts)).
The server MUST treat it as the deployable paywall's identity: dedupe storage by
it, use it as the device cache key (§4.3), and expose it in resolve responses.

---

## 4. Delivery API **[server]**

How a device gets a paywall to show. The SDK never references a deploy or a raw
paywall id directly — it asks for a **placement**, and the server resolves the
placement through the active **channel** to a concrete paywall version + the
products/variables to inject.

### 4.1 Resolve a placement

```
GET /v1/paywalls/resolve?placement=onboarding&platform=ios&locale=en-US
x-api-key: vh_pk_…            // PUBLISHABLE key (safe to ship in the app)
```

```jsonc
200 OK
{
  "placement": "onboarding",
  "paywall": {
    "id": "onboarding-green",
    "contentHash": "5b00934c90ee…",
    "url": "https://paywalls.voidhash.com/p/5b00934c90ee…/index.html",
    "assetBaseUrl": "https://paywalls.voidhash.com/p/5b00934c90ee…/"
  },
  "runtime": {                 // becomes window.__VOIDHASH_PAYWALL__ (see §5.1)
    "products": [
      { "id": "com.app.pro.yearly", "displayName": "Yearly", "priceString": "$59.99",
        "price": 59.99, "currencyCode": "USD", "period": "year", "trialPeriod": "7d" }
    ],
    "variables": { "accentColor": "#16a34a" },
    "locale": "en-US",
    "platform": "ios",
    "defaultSelectedProductId": "com.app.pro.yearly"
  },
  "presentation": { "style": "fullScreen" }   // optional SDK presentation hints
}
```

- **No paywall assigned** to the placement → `204 No Content`. The SDK shows
  nothing (or a hardcoded fallback). Never error the app over a missing paywall.
- **`products`** — the server resolves the placement's product group to store
  product ids. The SDK enriches localized price/title from StoreKit/Billing and
  presents; the server's `priceString`/`price` are display fallbacks. (The
  `products`/`variables` map 1:1 onto `PaywallRuntimeConfig`; see §5.1.)
- **`variables`** — author-overridable values, the seam for A/B tests &
  remote config. Returning different paywall ids or variables per audience is how
  experiments are run — opaque to this MVP, but `resolve` is the hook.

### 4.2 Serving the bundle

`paywall.url` serves the stored `index.html`; `assetBaseUrl` + the asset filename
serves each asset. The HTML references `./bundle.js` and `./assets/…` relatively,
so **all three must be served under the same path prefix** (`/p/<contentHash>/`).
Recommended: object storage + CDN, immutable + long `Cache-Control` (content is
addressed by hash, so it never changes for a given URL).

`Content-Type` per the manifest. Set permissive CORS / WebView-friendly headers.
The SDK MAY also pre-fetch and serve the bundle from a local cache (see §4.3).

### 4.3 Caching & offline

- The bundle URL is immutable per `contentHash`; the SDK SHOULD cache by it and
  reuse across launches, only re-downloading when `resolve` returns a new hash.
- The SDK SHOULD pre-warm the current paywall on app start so presentation is
  instant and works offline.
- `resolve` responses are short-lived (products/prices change); the bundle is
  effectively permanent.

---

## 5. Runtime contract **[done — server must conform]**

Once the WebView loads the bundle, two channels connect it to the native app.

### 5.1 Config injection

Before the bundle script runs, the SDK MUST set the global
`window.__VOIDHASH_PAYWALL__` to the `runtime` object from §4.1. On a React Native
WebView this is `injectedJavaScriptBeforeContentLoaded`:

```js
`window.__VOIDHASH_PAYWALL__ = ${JSON.stringify(runtime)};`;
```

The bundle reads it via `readInjectedConfig()` and exposes it to author code
through `usePaywallProducts()`, `usePaywallVariables()`, `useSelectedProduct()`,
`usePaywallStatus()`. The shape is `PaywallRuntimeConfig`
([`config.ts`](libraries/paywalls/src/runtime/config.ts)) — the server's `resolve`
`runtime` block MUST match it field-for-field. If injection is skipped the paywall
still mounts with no products (safe default).

### 5.2 The native bridge

Author actions (`usePaywallActions()`) are **requests** the paywall sends up to
the native host; the host owns the actual store transaction and pushes status
back down. The wire format is fixed in
[`bridge.ts`](libraries/paywalls/src/runtime/bridge.ts).

**Outbound — WebView → native** (delivered via `window.ReactNativeWebView.postMessage(json)`).
The SDK parses `event.nativeEvent.data` as JSON:

| `type`                      | Payload                 | Native action                                                 |
| --------------------------- | ----------------------- | ------------------------------------------------------------- |
| `voidhash.paywall.ready`    | —                       | Paywall mounted; safe to inject status.                       |
| `voidhash.paywall.purchase` | `{ productId }`         | Start StoreKit/Billing purchase for `productId`.              |
| `voidhash.paywall.restore`  | —                       | Restore entitlements.                                         |
| `voidhash.paywall.close`    | —                       | Dismiss the paywall.                                          |
| `voidhash.paywall.openUrl`  | `{ url }`               | Open `url` (terms/privacy) in a browser.                      |
| `voidhash.paywall.event`    | `{ name, properties? }` | Forward to analytics (ties into existing Voidhash analytics). |

**Inbound — native → WebView.** The SDK calls the function the runtime installs on
`window`:

```js
webview.injectJavaScript(`window.__voidhashPaywallReceive(${JSON.stringify(msg)});`);
```

| `type`                    | Payload                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `voidhash.paywall.status` | `{ status, productId?, error? }` where `status ∈ idle \| purchasing \| restoring \| purchased \| restored \| cancelled \| failed` |

The paywall reflects `status` (e.g. disables the CTA while `purchasing`). On
`purchased`/`restored` the SDK validates the receipt (existing Voidhash
server-side validation), unlocks the entitlement, and dismisses.

### 5.3 Purchase → entitlement (ties into existing platform)

The bridge only conveys intent. Receipt validation, entitlement state, and
revenue tracking continue to flow through the **existing** Voidhash subscription
APIs and analytics — this spec does not change them. The paywall is purely the
presentation + intent layer.

---

## 6. Suggested data model **[server]**

```
deploys              (id, team_id, project_id, schema_version, cli_version,
                      runtime_version, created_at, status, manifest_json)
blobs                (sha256 PK, bytes, content_type, storage_key)      -- content-addressed
deploy_files         (deploy_id, role, logical_path, sha256 → blobs)    -- role: html|js|asset|source|config
paywalls             (id, deploy_id, slug, title, description, content_hash)
placements           (id, project_id, key)                              -- e.g. "onboarding"
channels             (id, project_id, key)                              -- e.g. "production"
placement_assignments(channel_id, placement_id, paywall_content_hash, product_group_id, variables_json, updated_at)
```

- `blobs` deduped by `sha256` across all deploys ⇒ unchanged bundles/assets stored
  once.
- A **deploy** is immutable; **assignments** are the only mutable, audience-facing
  state (what `resolve` reads). This cleanly separates "what was built" from "what
  is live", enabling instant rollback (repoint an assignment) without a rebuild.

---

## 7. Cross-cutting **[server]**

- **Versioning.** Honor `manifest.schemaVersion`; reject unknown majors with a
  clear "upgrade the CLI" error. Echo a server `apiVersion`.
- **Idempotency.** Re-POSTing an identical manifest (same file set) returns the
  same `deployId` (key on team+project+manifest hash). Blob PUTs are idempotent by
  hash.
- **Limits.** Cap bundle size (e.g. 5 MB) and asset size; return `413` with the
  offending path. Validate `contentType` against an allowlist.
- **Validation.** On finalize, recompute each paywall's `contentHash` from stored
  blobs and reject mismatches — never serve an unverified bundle.
- **Auth split.** Deploy needs a **secret** key (`vh_sk_`); `resolve` + bundle/asset
  serving accept the **publishable** key (`vh_pk_`). Bundles/assets are public,
  immutable, content-addressed — no secrets ever go in a paywall bundle.
- **Errors.** JSON `{ error: { code, message, details? } }`; `4xx` for client
  faults (bad hash, scope mismatch, missing blob), `5xx` for server faults.

---

## 8. Out of scope (future)

- **GUI paywall builder** — will read the stored **raw source** and prop schemas
  (`defineComponent` editor metadata: kind/label/default/options) to render an
  editor. The deploy already ships everything it needs.
- **Native renderers** — the renderer is abstracted behind a host-component
  registry (`RendererProvider`), so a future native target reuses the same authored
  paywalls without server changes; delivery would serve a native bundle instead of
  HTML/JS, keyed by the same `contentHash` model.
- **Experiments / targeting** — `resolve` is the designed hook (return different
  paywall/variables per audience); the allocation engine is a later task.

---

## 9. Server implementation checklist

- [ ] `POST /v1/paywalls/deploys` — accept `DeployManifest`, return `{ deployId, missing[] }`.
- [ ] `PUT /v1/paywalls/deploys/:id/blobs/:sha256` — verify hash, store blob.
- [ ] `POST /v1/paywalls/deploys/:id/finalize` — validate completeness + hashes, mark ready.
- [ ] Object storage + CDN for `/p/<contentHash>/index.html|bundle.js|assets/*` (immutable, CORS, correct `Content-Type`).
- [ ] `GET /v1/paywalls/resolve` — placement → `{ paywall.url, contentHash, runtime{products,variables,…} }`, `204` when unassigned.
- [ ] Dashboard: assign placement → paywall, publish to a channel, rollback.
- [ ] Enforce key scopes (`vh_sk_` deploy, `vh_pk_` resolve) + size/type limits.
- [ ] Keep `runtime` (resolve) and the bridge message types in lockstep with `@voidhash/paywalls`; bump `schemaVersion` on breaking changes.
- [ ] Wire the CLI upload: replace the `// Upload` placeholder in `deploy.ts` with the phase-1/2 calls.

```

```
