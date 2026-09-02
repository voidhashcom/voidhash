# Paywall Deploy Contract (Phase 1)

**Status:** Implementation contract for PRD "Paywall Code Components" Phase 1.
**Implementors:** `voidhash` (SDK `@voidhash/paywalls`, Studio, `@voidhash/react-native`, backend, and www).
**Rule:** this file is the wire-format source of truth. Every implementation validates against schemas that mirror this document exactly. Breaking changes bump `schemaVersion`.

---

## 1. Deploy manifest — `schemaVersion: 2`

Produced by code-paywall deployment tooling. Supersedes the v1 manifest (whole file, not additive).

```jsonc
{
  "schemaVersion": 2,
  "cliVersion": "0.0.1-alpha.1",
  "runtimeVersion": "0.0.1-alpha.1", // @voidhash/paywalls version built against
  "team": "voidhash-dev-sro", // organization slug
  "project": "dev-proj", // project slug
  "createdAt": "2026-06-11T10:00:00.000Z",

  "paywalls": [
    {
      "id": "onboarding", // slug, from filename; ^[a-z0-9][a-z0-9-]{0,63}$
      "title": "Onboarding",
      "description": "Full-screen onboarding paywall.", // optional
      "products": ["yearly", "monthly"], // product slugs the paywall uses (may be empty)
      "variables": { "accentColor": "#16a34a" }, // string|number|boolean values only
      "source": { "path": ".voidhash/paywalls/onboarding.tsx", "bytes": 4096, "sha256": "…" },
      "artifacts": {
        "html": {
          "path": ".voidhash/.build/paywalls/onboarding/index.html",
          "bytes": 900,
          "sha256": "…",
          "contentType": "text/html; charset=utf-8",
        },
        "js": {
          "path": ".voidhash/.build/paywalls/onboarding/bundle.js",
          "bytes": 201000,
          "sha256": "…",
          "contentType": "text/javascript; charset=utf-8",
        },
      },
      "assets": [".voidhash/.build/paywalls/onboarding/assets/hero-AB12CD.png"], // paths into top-level assets[]
      "contentHash": "5b00934c90ee…", // see §1.2
    },
  ],

  "components": [
    {
      "id": "product-option", // slug, from filename; same regex as paywall ids
      "title": "Product Option", // optional, from definition
      "source": { "path": ".voidhash/components/product-option.tsx", "bytes": 1500, "sha256": "…" },
      "manifest": {
        "path": ".voidhash/.build/components/product-option/manifest.json",
        "bytes": 800,
        "sha256": "…",
        "contentType": "application/json",
      },
      "previews": [
        {
          "state": "default",
          "file": {
            "path": ".voidhash/.build/components/product-option/previews/default.json",
            "bytes": 2000,
            "sha256": "…",
            "contentType": "application/json",
          },
        },
      ],
      "artifacts": {
        "runtime": {
          "path": ".voidhash/.build/components/product-option/runtime.js",
          "bytes": 6000,
          "sha256": "…",
          "contentType": "text/javascript; charset=utf-8",
        },
        "panel": null, // or a file entry when the component declares a custom panel
      },
      "contentHash": "ab93f1…", // see §1.2
    },
  ],

  "config": { "path": "voidhash.config.ts", "bytes": 120, "sha256": "…" },

  "assets": [
    {
      "path": ".voidhash/.build/paywalls/onboarding/assets/hero-AB12CD.png",
      "bytes": 88000,
      "sha256": "…",
      "contentType": "image/png",
    },
  ],
}
```

File entry shapes (same as v1): `DeployFile = { path, bytes, sha256 }`, `DeployArtifact = DeployFile + { contentType }`. `path` is POSIX, relative to project root. `sha256` is lowercase hex of the raw bytes.

### 1.1 Constraints (server rejects violations at finalize)

- `paywalls[].id`, `components[].id` unique within the manifest, regex above.
- `variables` values: `string | number | boolean` only.
- Size caps: js bundles ≤ 5 MB, assets ≤ 10 MB each, manifest body ≤ 1 MB, component manifest ≤ 256 KB, preview tree ≤ 512 KB, paywall html ≤ 1 MB, source files ≤ 1 MB, config ≤ 256 KB. Caps are enforced on the ACTUAL uploaded bytes (upload rejects a body whose length differs from the declared `bytes` or exceeds the role cap) and re-verified at finalize against the recorded blob sizes.
- `contentType` allowlist: `text/html`, `text/javascript`, `application/json`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`, `font/ttf`, `font/otf`, `font/woff`, `font/woff2` (charset suffixes allowed).
- Per-role `contentType` rules (validated at finalize, on the bare type before any charset suffix):
  - paywall `html` artifact: `text/html` only.
  - paywall `js`, component `runtime`, component `panel`: `text/javascript` only.
  - component `manifest` and `previews[].file`: `application/json` only.
  - `assets[]`: `image/*` or `font/*` types from the allowlist only — never `text/html` or `text/javascript`.
- At least one paywall **or** one component.
- `components[].previews` non-empty (deployment tooling always emits a `default` tree).
- `previews[].state` matches `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$` — state names become serving object keys and URL path segments (§5.1).
- Each decoded preview tree's `state` field (§3) equals its `previews[].state` entry. This binds the state→file mapping into the `contentHash` transitively; without it, the same file set with swapped state assignments would collide under one immutable `contentHash`.

### 1.2 `contentHash`

- Paywall: `sha256( sha256(html) + ":" + sha256(js) + ":" + sortedAssetHashes.join(":") )` — hex string concatenation, lowercase.
- Component: `sha256( sha256(manifest) + ":" + sha256(runtime) + ":" + (sha256(panel) | "") + ":" + sortedPreviewHashes.join(":") )`.

The paywall `contentHash` is the deployable identity: storage prefix, cache key, dedupe key.

## 2. Component manifest (`manifest.json` artifact)

Emitted per component by the authoring pipeline and validated server-side at finalize.

```jsonc
{
  "manifestVersion": 1,
  "id": "product-option",
  "title": "Product Option", // optional
  "description": "…", // optional
  "props": {
    "product": { "kind": "ref", "refType": "product", "label": "Product", "optional": false },
    "selected": { "kind": "boolean", "default": false, "optional": true },
    "accentColor": { "kind": "string", "editor": "color", "default": "#16a34a", "optional": true },
    "badge": { "kind": "component", "optional": true },
    "features": { "kind": "array", "item": { "kind": "string" }, "optional": true },
    "plan": { "kind": "select", "options": ["monthly", "yearly"], "optional": true },
  },
  "actions": {
    "onSelect": { "payload": { "productId": { "kind": "string" } } }, // payload may be {}
  },
  "slot": true, // exactly one <Slot/> allowed per component
  "previewStates": ["default", "trial"],
  "hostData": ["products"], // which injected runtime data the component reads
}
```

Prop kinds: `string | number | boolean | select | image | ref | component | array`. Per-kind fields and constraints:

| `kind`      | extra fields                                                                                   | `editor`                    | `default`                        |
| ----------- | ---------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------- |
| `string`    | —                                                                                              | allowed (`"color"` for now) | `string`                         |
| `number`    | —                                                                                              | not allowed                 | `number`                         |
| `boolean`   | —                                                                                              | not allowed                 | `boolean`                        |
| `select`    | `options`: **non-empty** `string[]` (empty options are a build error and rejected at finalize) | not allowed                 | `string`                         |
| `image`     | —                                                                                              | not allowed                 | `string` (URL / asset reference) |
| `ref`       | `refType`: `"product"` only in P1                                                              | not allowed                 | —                                |
| `component` | —                                                                                              | not allowed                 | —                                |
| `array`     | `item`: a non-array kind (carries the same per-kind fields)                                    | not allowed                 | array of scalars matching `item` |

`editor` is a UI hint and only legal on `string` props — the authoring API enforces this at the type level. Non-JSON-serializable defaults (e.g. React nodes) are omitted from the manifest. A prop with a `default` is always emitted with `optional: true`. All kinds also accept optional `label`, `description`, `optional`.

## 3. Preview node tree (`previews/<state>.json` artifact)

The component is rendered against the preview state's fixtures during the build, producing a tree of closed primitives. Never HTML.

```jsonc
{
  "treeVersion": 1,
  "state": "default",
  "root": {
    "type": "view", // view|text|image|pressable|scroll|slot|placeholder
    "style": { "flexDirection": "row", "padding": 16 }, // RN-compatible subset, see §3.1
    "children": [
      { "type": "text", "style": { "color": "#fff" }, "text": "Yearly" },
      { "type": "image", "style": {}, "src": "https://…", "resizeMode": "cover" },
      { "type": "slot" }, // slot marker — editor mounts children here
      { "type": "placeholder", "reason": "render returned null" },
    ],
  },
}
```

Node shapes: `view|pressable|scroll` have `style` + `children[]`; `text` has `style` + `text` (string); `image` has `style` + `src` + optional `resizeMode` (`"cover" | "contain" | "stretch" | "center"` — exactly these four values); `slot` has nothing else (at most one in the tree); `placeholder` has `reason`. `pressable` additionally has optional `action` (string — the declared action name it fires). No other keys; servers MUST reject unknown node types and unknown keys.

**Determinism ("poster frame").** A preview tree is a deterministic snapshot of the component, not a live render. It is produced by running the component with **real hooks** (`useState`/`useEffect`/… execute) under a frozen environment — `Date.now`, `Math.random`, `performance.now`, and `requestAnimationFrame` are pinned to fixed values — and read back after exactly one settle budget: one passive-effect flush (`react-reconciler`'s `flushPassiveEffects()`) followed by one macrotask tick. Whatever tree is committed at that point is the artifact. A component that has not stabilized within that single budget (e.g. it schedules further state updates on a timer or keeps chasing `requestAnimationFrame`) is **out of contract** — its captured tree is whatever the frozen clock produced at the tick, and reproducibility is not guaranteed. This is a semantics clarification of how the existing `treeVersion: 1` artifact is produced, not a format change; `treeVersion` is unchanged.

### 3.1 Style subset

Keys limited to the RN-compatible vocabulary: flexbox (`flex`, `flexDirection`, `alignItems`, `alignSelf`, `justifyContent`, `flexWrap`, `gap`, `rowGap`, `columnGap`, `flexGrow`, `flexShrink`, `flexBasis`), box (`width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `padding[Top|Bottom|Left|Right|Horizontal|Vertical]`, `margin[…same…]`, `aspectRatio`), border (`borderWidth`, `borderColor`, `borderRadius` + per-corner variants, `borderStyle`), visual (`backgroundColor`, `opacity`, `overflow`), position (`position`, `top`, `right`, `bottom`, `left`, `zIndex`), text-only (`color`, `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`, `letterSpacing`, `textAlign`, `textTransform`, `textDecorationLine`, `fontFamily`). Values: numbers, strings (colors, `"50%"`); no arbitrary CSS.

## 4. Deploy HTTP API (`voidhash` backend)

Base: the existing v1 API host. All three endpoints are part of the authenticated Studio/custom-tooling surface: header `x-api-key` accepting a user key or a `vh_sk_` secret key. The authenticated session must include a project whose `slug == manifest.project` within an organization whose `slug == manifest.team`; otherwise `403`.

### 4.1 Create deploy

```
POST /api/v1/paywall-deploys
Content-Type: application/json
Body: <DeployManifest>            // §1, validated against schemaVersion 2
→ 201 { "deployId": "pw_dep_…", "missing": ["<sha256>", …] }
```

`missing` = subset of manifest file hashes the server does not already have stored **for this project**. Idempotent: re-POSTing a manifest whose canonical hash matches an existing deploy of the same project — of **any** status; the (project, canonical manifest hash) pair is unique per project — returns that deploy. A pending match resumes uploading via the returned `missing` list; a ready match returns `missing: []`. Unknown `schemaVersion` → `400` with an upgrade-tooling message.

### 4.2 Upload blob

```
PUT /api/v1/paywall-deploys/:deployId/blobs/:sha256
Content-Type: application/octet-stream
Body: raw bytes
→ 200 {}
```

Server MUST verify `sha256(body) === :sha256` (reject mismatch with `422`) and that the hash appears in the deploy's manifest (`404` otherwise). Re-uploading an existing blob is a no-op `200`.

### 4.3 Finalize

```
POST /api/v1/paywall-deploys/:deployId/finalize
→ 200 {
  "deployId": "pw_dep_…",
  "status": "ready",
  "paywalls": [{ "id": "onboarding", "paywallId": "pw_…", "releaseId": "pw_pub_…", "version": 3, "contentHash": "…", "url": "https://…/p/<contentHash>/index.html" }],
  "components": [{ "id": "product-option", "componentId": "pw_cmp_…", "version": 2, "contentHash": "…" }]
}
```

Finalize is the immutable commit point. Server-side validation (trusts nothing): every referenced blob present; recompute every sha256 + every `contentHash`; schema-validate component manifests (§2) and preview trees (§3) from the stored blobs; enforce §1.1 caps. Any failure → `409 { missing: [...] }` for incompleteness, `422` with details for validation failures; the deploy stays pending and can be retried. On a `409` whose `missing` hashes map back to manifest files, the client can re-upload exactly those blobs and retry finalize. Finalizing an already-`ready` deploy is a fully re-validated no-op: it re-copies the idempotent serving objects and returns the current release/component summaries (releases are reused when the latest released `contentHash` matches, so no new versions are created).

Effects on success, per paywall in the manifest:

1. Upsert a `paywall` row by `(projectId, slug=id)` with `source = code`.
2. If the latest released release for that paywall already has this `contentHash`, reuse it (no new version). Otherwise create a released `paywall_release` row: `version = max+1`, `s3Key = "p/<contentHash>/index.html"`, `contentHash`, `deployId`, `runtimeConfig = { productSlugs, variables }`, and mark it active (previous active cleared).
3. Copy blobs into the public serving layout (§5).

Whenever a release becomes active for a CODE-source paywall (finalize activation or explicit release activation), every open location showing of that paywall still pinning a different release is ended and replaced by a new open showing pinning the newly-active release, atomically with the activation.

Per component: upsert `paywall_component` by `(projectId, slug)`; create a `paywall_component_version` (version = max+1, skip if latest has same `contentHash`) storing the component manifest JSON + artifact hashes.

## 5. Serving layout

Released paywall artifacts are public, immutable, content-addressed:

```
GET {publicBaseUrl}/p/<contentHash>/index.html
GET {publicBaseUrl}/p/<contentHash>/bundle.js
GET {publicBaseUrl}/p/<contentHash>/assets/<name>
```

- The HTML references `./bundle.js` and `./assets/…` relatively — everything under one prefix.
- Headers: correct `Content-Type` (from manifest), `Cache-Control: public, max-age=31536000, immutable`, permissive CORS (`Access-Control-Allow-Origin: *`).
- When artifacts are co-hosted with an authenticated origin (e.g. served from the API host), every `/p/*` response MUST additionally carry `Content-Security-Policy: sandbox allow-scripts allow-forms` (the CSP sandbox gives tenant-authored HTML an opaque origin: no same-origin credentialed API access, no `document.cookie`), `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer`.
- Recommendation: serve the artifacts from a dedicated cookieless domain before production traffic.
- `publicBaseUrl` is platform configuration (CDN or a backend serving route); the SDK never constructs these URLs — it uses `htmlUrl` from resolve verbatim.

### 5.1 Component artifacts

Finalize also copies each component's artifacts into the same public, immutable, content-addressed layout, keyed by the component `contentHash` (§1.2):

```
GET {publicBaseUrl}/c/<contentHash>/manifest.json
GET {publicBaseUrl}/c/<contentHash>/previews/<state>.json
GET {publicBaseUrl}/c/<contentHash>/runtime.js
GET {publicBaseUrl}/c/<contentHash>/panel.js          // only when the deploy manifest declares artifacts.panel
```

- Same headers as §5: declared `Content-Type`, `Cache-Control: public, max-age=31536000, immutable`, `Access-Control-Allow-Origin: *`, and the co-hosted security headers (CSP sandbox / nosniff / no-referrer).
- 404 and error responses on `/c/*` (and `/p/*`) also carry `Access-Control-Allow-Origin: *` — cross-origin consumers (e.g. the studio fetching preview trees) must observe a readable 404, not an opaque CORS failure.
- Clients never construct these URLs from the layout; the platform hands out `artifactBaseUrl = {publicBaseUrl}/c/<contentHash>` and consumers append the file names above.

## 6. Resolve extension

`POST /api/v1/sdk/resolve-paywall` response: the existing `SdkResolvedPaywall` shape, with `showing.paywallRelease` gaining one **optional** field:

```jsonc
"paywallRelease": {
  "releaseId": "pw_pub_…",
  "version": 3,
  "htmlUrl": "https://…/p/5b00934c…/index.html",
  "publishedAt": "…",
  "runtime": {                       // null/absent for visual-editor releases
    "contentHash": "5b00934c…",
    "productSlugs": ["yearly", "monthly"],
    "variables": { "accentColor": "#16a34a" }
  }
}
```

The device SDK: caches the bundle by `runtime.contentHash` when present; maps `productSlugs` through its native store metadata to build the injected products list; passes `variables` through unchanged.

## 7. Runtime config + bridge (WebView ⇄ native)

### 7.1 Config injection

The bundle reads `window.__VOIDHASH_PAYWALL__` (shape below) if set before it runs. Because the current native presenter cannot inject before-load scripts, the runtime ALSO accepts late configuration: it renders immediately with the injected-or-empty config and applies a `configure` message (§7.2) whenever one arrives.

```ts
interface PaywallRuntimeConfig {
  products: Array<{
    id: string; // store product id
    slug: string; // voidhash product slug
    displayName: string;
    description?: string;
    price?: number;
    priceString: string; // locale-correct, from StoreKit/Play Billing
    currencyCode?: string;
    period?: "month" | "year" | "week" | "lifetime";
    trialPeriod?: string; // e.g. "7d"
  }>;
  variables: Record<string, string | number | boolean>;
  locale?: string;
  platform?: "ios" | "android" | "web";
  defaultSelectedProductId?: string;
}
```

### 7.2 Bridge protocol

The **normative implementation** is `libraries/react-native/src/internal/paywall-bridge/protocol.ts` (envelope `version: 1`) — the native presenter and SDK handler already speak it. The new runtime conforms to it, plus one new inbound action:

- Outbound (paywall → native): envelopes for `ready`, `purchase { productId }`, `restore`, `close`, `openExternal { url }`, `event { name, properties? }` — exact action names/payload keys per protocol.ts. Sent via `window.ReactNativeWebView.postMessage(json)`; in studio/preview contexts via `window.parent.postMessage({ source: "voidhash-paywall", message }, "*")`.
- Inbound (native → paywall): delivered by the presenter to the runtime's installed global (per protocol.ts / the existing native implementations — the runtime installs whatever global the native side already calls). Actions: existing success/error responses + status updates, plus **`configure`** with payload `PaywallRuntimeConfig` (§7.1). The SDK sends `configure` immediately after receiving `ready`.

If the OSS implementor finds protocol.ts and the native presenters disagree on any detail, the **native presenters win** (Swift/Kotlin are not modified in P1) and protocol.ts/the runtime are aligned to them.

## 8. Versioning

- `schemaVersion` (manifest, §1): server rejects unknown majors with an upgrade hint.
- `manifestVersion` (component manifest, §2) and `treeVersion` (§3): independent, validated at finalize.
- Bridge envelope `version: 1`: unchanged in P1.
