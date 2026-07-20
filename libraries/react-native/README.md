# Voidhash React Native SDK

React Native SDK for in-app purchases.

## Read-only observer mode

You can run the SDK in observer mode to coexist with other billing SDKs.

```ts
createVoidhashClient("pk_test", {
  readOnly: true,
  scheme: "myapp",
});
```

Behavior summary:

| Mode                        | Starts purchases | Syncs transactions to Voidhash | Confirms/acknowledges store transactions |
| --------------------------- | ---------------- | ------------------------------ | ---------------------------------------- |
| `readOnly: true`            | No               | Yes                            | No                                       |
| `readOnly: false` (default) | Yes              | Yes                            | Yes (after successful server sync)       |

Observer reconciliation:

- The SDK attaches the native purchase listener first.
- Reconciliation runs in the background and does not block init.
- Reconciliation sources are pending transactions and active purchase history.
- Client-side dedupe key is `platform + transactionId + purchaseDate`.
- The server endpoint is idempotent by store transaction identity to tolerate retries/duplicates.

## Unstable error swallowing

For early-alpha integrations, you can enable unstable side-effect error swallowing:

```ts
createVoidhashClient("pk_test", {
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

- `getCurrentPerson(...)`
- `getFeatureFlags(...)`
- `getPaywallForLocation(...)`
- `getProducts()`
- `purchase(...)`

This flag is intentionally unstable and best used for background/observer-style alpha integrations. It is not recommended for core purchase flow handling.

## HTTP debug mode

Enable verbose HTTP logging when debugging request/response flow:

```ts
createVoidhashClient("pk_test", {
  debug: true,
  scheme: "myapp",
});
```

When enabled, the SDK logs:

- Outgoing request method, URL, headers (with sensitive values redacted), and body summary.
- Incoming response status, headers, and request duration.
- HTTP/client errors with reason and status when available.

Release builds keep measurement diagnostic logging off unless a project-bound, signed, unexpired
support session is active. Diagnostic fields remain redacted even during an authorized session.

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

Cloud endpoints are used by default. Self-hosted deployments configure explicit origins; paths,
credentials, query strings, and fragments are rejected. HTTP is accepted only when both `debug`
and `allowInsecureDebugTransport` are enabled.

For local development with ingest on a different host/port, pass `ingestUrl`:

```ts
createVoidhashClient("pk_test", {
  debug: true,
  endpoints: {
    api: "http://localhost:5001",
    ingest: "http://localhost:8083",
    links: "http://localhost:8090",
    allowInsecureDebugTransport: true,
  },
  scheme: "myapp",
});
```

Only trusted configuration key IDs are exposed through diagnostics; public key material is never
included in `measurement.getState()`.

## Unified measurement API

The SDK has four namespaces with one shared identity, consent revision, session, and durable record
sequence:

```ts
const voidhash = createVoidhashClient("pk_test", {
  scheme: "myapp",
  consent: {
    revision: 1,
    decidedAt: new Date().toISOString(),
    source: "application",
    dataUsage: true,
  },
  measurement: {
    defaultCurrency: "USD",
    context: { releaseChannel: "production" },
    purchases: {
      enabled: true,
      enrichment: {
        ios: (transaction) => ({ source: "storekit", product: transaction.productId }),
        android: {
          subscription: (transaction) => ({ source: "billing", product: transaction.productId }),
        },
      },
    },
  },
  links: {
    allowedDomains: ["links.example.com"],
    allowedSchemes: ["https", "myapp"],
  },
  notifications: { registration: "manual" },
});

await voidhash.client.measurement.start();
await voidhash.client.consent.set({
  revision: 2,
  decidedAt: new Date().toISOString(),
  source: "application",
  partnerSharingOptOut: true,
});

const unsubscribe = voidhash.client.links.on("deepLink", (result) => {
  if (result.status === "found") routeTo(result.route.value);
});

await voidhash.client.notifications.requestPermission();
await voidhash.client.notifications.register();
const state = await voidhash.client.measurement.getState();
unsubscribe();
```

Configuration and input failures are typed `MeasurementError` subclasses. Missing native
capabilities reject with `MeasurementCapabilityUnavailable`; methods never pretend success.

### Privacy and protected fields

Every record snapshots identity, consent, session, app, and device state when it is captured.
Changing identity or consent later does not rewrite queued records. Raw URLs, push tokens, receipts,
advertising identifiers, email, and phone are rejected from public event properties and context.
Link and notification payloads are referenced as protected evidence and do not appear in delivery
diagnostics or `measurement.getState()`.

Location is denied by default and is accepted only as an explicit manual measurement input after
enabling the location collection policy. Advertising and vendor identifiers remain unavailable when
their collectors are not present or policy disables them.

### Expo native configuration

The package's Expo plugin configures associated domains, URL schemes, App Links, push entitlement
and permission policy, background notification mode, the default Android notification channel, and
an embedded redacted capability manifest. Invalid domains, schemes, paths, or incomplete Android
push configuration fail prebuild.

```json
{
  "plugins": [
    [
      "@voidhash/react-native",
      {
        "measurement": {
          "ios": {
            "associatedDomains": ["links.example.com"],
            "urlSchemes": ["myapp"]
          },
          "android": {
            "appLinks": [{ "host": "links.example.com", "autoVerify": true }],
            "urlSchemes": ["myapp"]
          }
        },
        "notifications": {
          "enabled": true,
          "ios": { "apsEnvironment": "production", "backgroundRemoteNotifications": true },
          "android": {
            "googleServicesFile": "./google-services.json",
            "postNotifications": "include",
            "defaultChannel": { "id": "updates", "name": "Updates", "importance": "high" }
          }
        }
      }
    ]
  ]
}
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
