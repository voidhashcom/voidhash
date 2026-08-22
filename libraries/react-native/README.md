# Voidhash React Native SDK

React Native SDK for in-app purchases, paywalls, entitlements, and product analytics.

Full documentation: <https://voidhash.com/docs/react-native>. This file covers the details most
often needed while integrating.

## Install

```sh
npm install @voidhash/react-native react-native-nitro-modules @react-native-async-storage/async-storage effect expo-constants expo-linking
```

Run `npx pod-install` after installing on iOS. Android needs no extra setup.

The package ships native code, so it requires a development build — Expo Go cannot load it.

The native layer is built on the shared `VoidhashCore` library from `@voidhash/ios` (installed
automatically as a dependency). Expo apps get its pod through this package's config plugin during
prebuild; bare React Native apps must add it to their Podfile manually:

```ruby
pod "VoidhashCore", :path => "../node_modules/@voidhash/ios"
pod "Voidhash", :path => "../node_modules/@voidhash/ios"
```

## Embedded native engine

The SDK can route all `/api/v1/sdk` traffic through the bare-native Voidhash clients (Swift /
Kotlin) instead of the TypeScript networking stack — headers, environment mode and transport are
then built natively, exactly like a pure-native integration, while the public API stays identical:

```ts
createVoidhashClient("pk_live_…", { unstable_nativeEngine: true });
```

When the platform does not ship the engine hybrid, the SDK falls back to its TypeScript transport
transparently. Identity remains owned by the JS layer: every engine call carries the current
distinct id explicitly, so the two sides can never diverge.

### Compatibility

| Dependency                   | Requirement                              |
| ---------------------------- | ---------------------------------------- |
| `react-native-nitro-modules` | Peer `^0.35.5` — 0.35.x                  |
| Expo SDK                     | Verified on 55; developed against 54     |
| React Native                 | Verified on 0.83; developed against 0.81 |
| Platforms                    | iOS and Android                          |

Every Nitro-based module in the app resolves against one shared native runtime. Mixing Nitro
versions across modules produces native build or load failures that do not point back at Voidhash.

## Create the client

`createVoidhashClient` takes the publishable key and an options object. There is no schema
argument: the schema lives on the server and is fetched when the provider mounts. Slug types come
from `voidhash.gen.d.ts`, written by `npx voidhash-cli types generate`.

```ts
import { createVoidhashClient } from "@voidhash/react-native";

export const voidhash = createVoidhashClient("vh_pk_...", {
  scheme: "myapp",
});
```

| Option                   | Default                    | Notes                                                        |
| ------------------------ | -------------------------- | ------------------------------------------------------------ |
| `scheme`                 | Expo app scheme            | Purchase callback scheme. Required unless Expo provides one. |
| `distinctId`             | Persisted anonymous id     | Seed the initial identity; usually omit and `identify()`.    |
| `debug`                  | `false`                    | Verbose HTTP logging.                                        |
| `dev`                    | `false`                    | Fake-store purchases in debug builds; ignored in release.    |
| `enabled`                | `true`                     | `false` ships the SDK fully inert. Fixed at construction.    |
| `readOnly`               | `false`                    | Observer mode. Mutable via `client.setReadOnly()`.           |
| `baseUrl`                | `https://api.voidhash.com` | API origin.                                                  |
| `ingestUrl`              | Same origin as `baseUrl`   | Analytics origin override.                                   |
| `unstable_swallowErrors` | `false`                    | See below.                                                   |

## Provider and initialization

Mount the provider once at the app root. It initializes identity, schema, person state, the store
adapter, and the transaction observer.

```tsx
export default function RootLayout() {
  return (
    <voidhash.Provider>
      <App />
    </voidhash.Provider>
  );
}
```

`useVoidhash()` exposes the lifecycle so an initialization failure does not strand the app:

```tsx
const { status, initError, retryInit, client } = voidhash.useVoidhash();
// status: "initializing" | "ready" | "failed" | "disabled"

if (status === "failed") {
  return <RetryScreen error={initError} onRetry={retryInit} />;
}
```

`retryInit()` re-runs `init()` and no-ops while initializing, ready, or disabled.

### Disabled clients

`enabled: false` returns a fully inert client: no native store connection, no network, no
listeners. `init()` and every side-effect method no-op, reads answer with their empty shape, and
the `scheme` requirement is waived.

```ts
export const voidhash = createVoidhashClient("vh_pk_...", {
  enabled: false,
});
```

Mount the provider unconditionally either way. Every hook still mounts on a disabled client, so
hook order never changes between a flagged-off and a flagged-on build. `enabled` is fixed at
construction; enabling later means creating a new client, which is cheap because a disabled one
never built its runtime.

## Read-only observer mode

Observer mode lets the SDK coexist with an existing billing integration during a migration.

```ts
createVoidhashClient("vh_pk_...", {
  readOnly: true,
  scheme: "myapp",
});
```

| Mode                        | Starts purchases | Syncs transactions to Voidhash | Finishes/acknowledges store transactions |
| --------------------------- | ---------------- | ------------------------------ | ---------------------------------------- |
| `readOnly: true`            | No               | Yes                            | No                                       |
| `readOnly: false` (default) | Yes              | Yes                            | Yes (after successful server sync)       |

`client.purchase()` and `client.setPersonAttributesSync()` are blocked in observer mode; hosted
paywall purchase actions fail the same way, because they call `purchase()` internally. Reads,
`restorePurchases()`, `setPersonAttributes()`, and analytics keep working.

Switch ownership at runtime instead of recreating the client:

```ts
voidhash.client.setReadOnly(false); // Voidhash now owns purchases
voidhash.client.isReadOnly; // boolean
```

The switch takes effect at the next decision point of each consumer: purchase gating, the observer's
finish/acknowledge decision, and the `x-observer-mode` request header. A purchase already in flight
keeps the mode it started with, so a `setReadOnly(true)` landing mid-purchase can never strand that
transaction unfinished with the store.

Observer reconciliation:

- The SDK attaches the native purchase listener first.
- Reconciliation runs in the background and does not block `init()`.
- Reconciliation sources are pending transactions and active purchase history.
- The client-side dedupe key is `platform + transactionId + purchaseDate`.
- The server endpoint is idempotent by store transaction identity, tolerating retries and duplicates.

## Paywalls

`usePaywallByLocation(locationSlug, options?)` preloads and presents a paywall through a native
full-screen presenter.

```ts
const { show } = voidhash.usePaywallByLocation("onboarding", {
  onPurchase: ({ productId, requestId }) => console.log("Purchased", productId, requestId),
  onRestore: ({ requestId }) => console.log("Restored", requestId),
  onError: (error, { action }) => console.error("Paywall action failed", action, error),
  onPreloadError: (error) => reportError("preload", error),
});

const result = await show();

if (result.status !== "shown") {
  // fall back to an app-owned screen
}
```

`show()` never rejects. It resolves to a `ShowPaywallResult`:

```ts
type ShowPaywallResult =
  | { status: "shown" }
  | { status: "disabled" } // client created with `enabled: false`
  | { status: "not_initialized" } // still initializing, or used outside the provider
  | { status: "native_unavailable" } // no native presenter on this platform
  | { status: "not_assigned" } // no published paywall for the location
  | { status: "initialization_failed"; error: Error }
  | { status: "failed"; error: Error };
```

`onPreloadError` reports a failed background preload. The SDK retries on the next app foreground
and again on `show()`, and a `show()` hitting the same failure returns `failed` rather than calling
the callback. Preload failures are also logged with `console.warn` in every environment.

Behavior:

- Assignment is resolved in JS (`getPaywallForLocation`), then preloaded natively (Swift/Kotlin).
- Presentation is native full-screen — no React Native `Modal` dependency.
- Preload runs on hook mount and when the app returns to the foreground.
- Pre-rendered native WebViews stay warm while hook instances are active for a location.

Bridge actions:

- Incoming actions: `ready`, `close`, `purchase`, `restore`, `openExternal`, `event`, `log`.
- `purchase` and `restore` return structured response envelopes (`success` / `error`).
- A successful `purchase` or `restore` auto-dismisses the presenter.
- `onPurchase`, `onRestore`, and `onError` fire for the corresponding bridge outcome.

## Unstable error swallowing

For early-alpha integrations, side-effect methods can log instead of rejecting:

```ts
createVoidhashClient("vh_pk_...", {
  scheme: "myapp",
  unstable_swallowErrors: true,
});
```

Swallowed (warn, return `Result.ok`): `init()`, `end()`, `identify(...)`, `reset()`, `signOut()`,
`setPersonAttributes(...)`, `restorePurchases()`, `flush()`, `iosPresentCodeRedemptionSheet()`,
`iosShowManageSubscriptions()`.

Strict (return `Result.err` on failure): `getCurrentPerson(...)`, `getFeatureFlags(...)`,
`getPaywallForLocation(...)`, `getProducts()`, `hasPerk(...)`, `setPersonAttributesSync(...)`,
`purchase(...)`.

Every fallible client method returns a [`Result`](https://better-result.dev) from better-result and
never rejects:

```ts
const products = await client.getProducts();
if (products.isOk()) {
  render(products.value);
} else if (products.error.code === "FAILED_TO_GET_PRODUCTS") {
  retry(products.error);
}
```

This flag is intentionally unstable and best used for background/observer-style alpha integrations.
It is not recommended for core purchase flow handling.

## HTTP debug mode

```ts
createVoidhashClient("vh_pk_...", {
  debug: true,
  scheme: "myapp",
});
```

Logs outgoing method, URL, headers (sensitive values redacted), and body summary; incoming status,
headers, and duration; and HTTP/client errors with reason and status where available.

## Product analytics

```ts
voidhash.client.capture("cta-button-clicked", {
  button_name: "Get Started",
  page: "homepage",
});
```

Events are batched with these defaults:

- Batch size: `20`
- Flush interval: `5000ms`
- Inline retry: exponential backoff, up to 3 total attempts

Force delivery with `await voidhash.client.flush()`. `client.end()` performs a final awaited
`flush()` before shutdown.

### Ingest URL configuration

Ingestion uses the `/i/v1/...` path prefix on the same origin as `baseUrl`. Pass `ingestUrl` to
point analytics at a different host during local development:

```ts
createVoidhashClient("vh_pk_...", {
  baseUrl: "http://localhost:1337",
  ingestUrl: "http://localhost:1339",
  scheme: "myapp",
});
```

# Contributing
