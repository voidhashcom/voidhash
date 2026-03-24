# Voidhash React Native SDK

React Native SDK for in-app purchases.

## Read-only observer mode

You can run the SDK in observer mode to coexist with other billing SDKs.

```ts
createVoidhashClient("pk_test", schema, {
  readOnly: true,
  scheme: "myapp",
});
```

Behavior summary:

| Mode | Starts purchases | Syncs transactions to Voidhash | Confirms/acknowledges store transactions |
|---|---|---|---|
| `readOnly: true` | No | Yes | No |
| `readOnly: false` (default) | Yes | Yes | Yes (after successful server sync) |

Observer reconciliation:

- The SDK attaches the native purchase listener first.
- Reconciliation runs in the background and does not block init.
- Reconciliation sources are pending transactions and active purchase history.
- Client-side dedupe key is `platform + transactionId + purchaseDate`.
- The server endpoint is idempotent by store transaction identity to tolerate retries/duplicates.

## Unstable error swallowing

For early-alpha integrations, you can enable unstable side-effect error swallowing:

```ts
createVoidhashClient("pk_test", schema, {
  readOnly: true,
  scheme: "myapp",
  unstable_swallowErrors: true,
});
```

When `unstable_swallowErrors: true`, the SDK logs warnings and does not reject for:

- `init()`
- `end()`
- `identify(...)`
- `reset()`
- `restorePurchases()`
- `flush()`
- `iosPresentCodeRedemptionSheet()`
- `iosShowManageSubscriptions()`

The following remain strict and still reject on failures:

- `getCurrentCustomer(...)`
- `getFeatureFlags(...)`
- `getPaywallForLocation(...)`
- `getProducts()`
- `purchase(...)`

This flag is intentionally unstable and best used for background/observer-style alpha integrations. It is not recommended for core purchase flow handling.

## HTTP debug mode

Enable verbose HTTP logging when debugging request/response flow:

```ts
createVoidhashClient("pk_test", schema, {
  debug: true,
  scheme: "myapp",
});
```

When enabled, the SDK logs:

- Outgoing request method, URL, headers (with sensitive values redacted), and body summary.
- Incoming response status, headers, and request duration.
- HTTP/client errors with reason and status when available.

## Product analytics capture

Use `client.capture(...)` to send product analytics events:

```ts
voidhash.client.capture("cta-button-clicked", {
  button_name: "Get Started",
  page: "homepage",
});
```

Events are sent in batches with these defaults:

- Batch size: `20`
- Time limit: `5000ms`
- Retry: up to `3` retries with exponential backoff

You can force delivery with:

```ts
await voidhash.client.flush();
```

`client.end()` also performs a final awaited `flush()` before shutdown.

### Ingest URL configuration

By default, ingest URL is derived from `baseUrl` by prefixing host with `i.` and posting to `/v1/events`.

For local development with ingest on a different host/port, pass `ingestUrl`:

```ts
createVoidhashClient("pk_test", schema, {
  baseUrl: "http://localhost:5001",
  ingestUrl: "http://localhost:8083",
  scheme: "myapp",
});
```

## Native paywall preloading + presentation

The SDK exposes `usePaywallByLocation(locationSlug, options?)` to preload and present paywalls with a native full-screen presenter.

```ts
const { show } = voidhash.usePaywallByLocation("onboarding", {
  onError: (error, context) => {
    console.error("Paywall action failed", context.action, error.message);
  },
  onPurchase: ({ productId, requestId }) => {
    console.log("Purchase succeeded", productId, requestId);
  },
  onRestore: ({ requestId }) => {
    console.log("Restore succeeded", requestId);
  },
});

const didShow = await show();
if (!didShow) {
  // no published paywall for this location
}
```

Behavior:

- Paywall assignment is resolved in JS (`getPaywallForLocation`), then preloaded in native (Swift/Kotlin).
- Presentation is native full-screen (no React Native `Modal` dependency).
- Preload runs on hook mount and when app returns to foreground.
- Pre-rendered native WebViews stay warm while hook instances are active for a location.

Bridge actions:

- Supported incoming actions: `purchase`, `restore`, `close`, `openExternal`, `log`.
- `purchase` and `restore` return structured response envelopes back to the paywall page (`success` / `error`).
- Successful `purchase` or `restore` auto-dismisses the presenter modal.
- Hook callbacks:
  - `onPurchase` fires after successful native purchase bridge action.
  - `onRestore` fires after successful native restore bridge action.
  - `onError` fires when `purchase` or `restore` bridge action fails.

### Add the package to your npm dependencies

```
npm install @voidhash/react-native
```

### Configure for Android

No additional setup necessary.

### Configure for iOS

Run `npx pod-install` after installing the npm package.

# Contributing
