# Voidhash React Native SDK

React Native SDK for entitlements, feature flags, product analytics, and observer-mode revenue
tracking.

> **Initial release:** SDK-started purchases and hosted paywalls are temporarily unavailable. The
> SDK always runs in observer mode: it observes and submits store transactions to Voidhash, but
> never finishes or acknowledges them. The host billing integration remains the transaction owner.

Full documentation: <https://voidhash.com/docs/react-native>. This file covers the details most
often needed while integrating.

## Install

```sh
npm install @voidhash/react-native react-native-nitro-modules effect
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
  debug: __DEV__,
});
```

| Option                   | Default                     | Notes                                                              |
| ------------------------ | --------------------------- | ------------------------------------------------------------------ |
| `scheme`                 | First URL scheme of the app | Deep-link scheme for purchase callbacks; read natively if omitted. |
| `distinctId`             | Persisted anonymous id      | Seed the initial identity; usually omit and `identify()`.          |
| `debug`                  | `false`                     | Verbose HTTP logging.                                              |
| `dev`                    | `false`                     | Reserved for SDK-started test purchases.                           |
| `enabled`                | `true`                      | `false` ships the SDK fully inert. Fixed at construction.          |
| `readOnly`               | `true`                      | Forced on while commerce features are unavailable.                 |
| `baseUrl`                | `https://api.voidhash.com`  | API origin.                                                        |
| `ingestUrl`              | Same origin as `baseUrl`    | Analytics origin override.                                         |
| `screenTracking`         | `{ enabled: true }`         | Automatic `$screen` events; see "Screen tracking".                 |
| `preloadPlacements`      | `[]`                        | Paywall placements to warm at boot; see "Offline behavior".        |
| `onDiagnostic`           | none                        | Reports failures the SDK recovered from; see below.                |
| `connectivity`           | none                        | Optional reachability source; see "Offline behavior".              |
| `unstable_swallowErrors` | `false`                     | Deprecated; see below.                                             |

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

## Observer mode and transaction reporting

The initial release always runs with `client.isReadOnly === true`. Passing `readOnly: false` or
calling `client.setReadOnly(false)` cannot transfer store ownership to Voidhash yet.

| Starts purchases | Syncs transactions to Voidhash | Finishes/acknowledges store transactions |
| ---------------- | ------------------------------ | ---------------------------------------- |
| No               | Yes                            | No                                       |

`client.purchase()` returns `READ_ONLY_PURCHASE_NOT_ALLOWED`. `client.setPersonAttributesSync()`
is also blocked by observer mode. Reads, `restorePurchases()`, asynchronous
`setPersonAttributes()`, identity, feature flags, and analytics keep working.

Observer reconciliation:

- The SDK attaches the native purchase listener first.
- Reconciliation runs in the background and does not block `init()`.
- Reconciliation sources are pending transactions and active purchase history.
- The client-side dedupe key is `platform + transactionId + purchaseDate`.
- The server endpoint is idempotent by store transaction identity, tolerating retries and duplicates.

## Paywalls

Hosted paywalls are temporarily unavailable in the initial release. The compatibility surface is
kept in the package for the upcoming launch, but it is inert: `getPaywallForLocation()` returns
`Ok(null)`, `usePaywallByLocation(...).show()` returns `{ status: "disabled" }`, and the SDK does
not resolve, preload, or present a paywall.

## Offline behavior

Initialization and cached reads tolerate an unreachable backend. Entitlements, flags and paywalls
use the last known state while analytics and supported writes wait for delivery. Without cached
data, reads return their documented empty or unavailable results; purchases still require a usable
store connection. Invalid inputs, rejected operations and operations without a safe fallback can
still report errors.

Fresh cached reads return immediately; stale reads use a bounded refresh budget. The SDK refreshes
state in the background, but cannot guarantee fresh server state while offline.

### Reads are cache-first

Initialization loads local state without waiting for backend or store connections. An initial
distinct ID is adopted locally and its alias is queued. On a cold start the schema can initially
be empty; subsequent operations use the refreshed schema when it arrives.

Requests for selected feature flags can reuse the current identity's cached full evaluation,
including stale evaluations while offline. Subset evaluations never stand in for a full evaluation.

`hasPerk`, `getCurrentPerson`, `getFeatureFlags` and `getPaywallForLocation` answer from the cached
value first. When that value is past its refresh window the SDK starts a refresh behind the read and
waits at most 500 ms for it before answering from cache; the refresh keeps running and lands for the
next read. Results carry `isStale` and, for person snapshots, `isExpired`, so an app that gates
high-value content can decide how much to trust an answer that has not been confirmed in a while.

```ts
const perk = await client.hasPerk("pro");
if (perk.isOk() && perk.value.hasAccess) {
  unlock({ trusted: !perk.value.isExpired });
}
```

`reason` says why an answer has the freshness it has: `fresh`, `refresh-in-flight` (cache served
while a refresh is still running), `refresh-failed` (the refresh finished without producing
anything), or `no-cache` (the SDK has never seen a snapshot for this identity, so
`hasAccess: false` means "no evidence", not "denied").

A stale or expired cached value is served after waiting at most 500 ms for the refresh. A cold
read has nothing to fall back on, so it waits for the request budget (about 10 s) instead.
`hasPerk`'s `allowStale` option is deprecated and no longer read — branch on `isStale` and
`isExpired` instead.

### Nothing queued is lost

Analytics events and store receipts are written to device storage and leave their queue only when
the server accepts them. Timeouts, 5xx responses, an open circuit and a paused authentication gate
all keep the data queued and retry it with jittered backoff — indefinitely. The only things that
drop an event are the queue cap (1000 events, oldest evicted first, each eviction reported through
`onDiagnostic`) and a server verdict that re-sending cannot change.

Store receipts go through a separate outbox that is written before the first network call and never
evicts an unacknowledged receipt, so a purchase made during an outage is still reported after the
next launch. A receipt leaves the outbox on any terminal outcome — accepted now, accepted by an
earlier run, or impossible to send — so it is never reprocessed forever.

`flush()` answers with `{ flushed, pending, lastError }`. A non-zero `pending` alongside a
`lastError` means the events are queued for another attempt, not lost.

### Refresh triggers

The SDK refreshes on its own at boot (schema, then person, flags and the paywalls it knows about),
on app foreground (debounced to once a minute), when a read finds a stale value, after a purchase,
and whenever `identify()` or `reset()` changes the identity — which also invalidates the person
snapshot and flag evaluations belonging to the previous one, and discards any refresh that was
already in flight for it. After a purchase the SDK refreshes grants again at 2 s and 5 s, because
the server needs a moment to turn an accepted receipt into an entitlement.

React Native ships no reachability API and this SDK adds no native dependency for one. If your app
already depends on a reachability library, hand its state in and the SDK will flush and refresh the
moment the device comes back:

```ts
import NetInfo from "@react-native-community/netinfo";

createVoidhashClient("vh_pk_...", {
  connectivity: {
    subscribe: (listener) =>
      NetInfo.addEventListener((state) => listener(state.isConnected === true)),
  },
});
```

Without it the SDK still recovers on its own: a host whose circuit is open is probed again after
30 s, and on every app foreground.

### Paywalls

A placement whose configuration has ever been resolved on this device is cached for seven days and
shows during an outage. A placement that has never resolved returns `{ status: "unavailable" }` from
`show()` — a state to retry, not a failure to report. Warm placements ahead of the first `show()`
with `preloadPlacements`:

```ts
createVoidhashClient("vh_pk_...", {
  preloadPlacements: ["onboarding", "settings_upsell"],
});
```

Placements the device has resolved before are preloaded at every launch without being listed.

### Diagnostics

`onDiagnostic` reports what the SDK handled on its own. Everything it reports has already been
recovered from — it is for your logging and alerting, not for recovery:

```ts
createVoidhashClient("vh_pk_...", {
  onDiagnostic: (diagnostic) => {
    if (diagnostic.kind === "auth" || diagnostic.kind === "eviction") {
      reportToMonitoring(diagnostic);
    }
  },
});
```

| Field        | Meaning                                                    |
| ------------ | ---------------------------------------------------------- |
| `kind`       | `transport`, `eviction`, `breaker`, `auth` or `cache`.     |
| `code`       | Stable identifier, for example `ANALYTICS_EVENT_DROPPED`.  |
| `operation`  | The SDK operation that produced it, for example `capture`. |
| `retryable`  | Whether the SDK will try the same work again on its own.   |
| `httpStatus` | Present when there was a response.                         |
| `message`    | Human-readable detail. Not stable; do not parse.           |

Exceptions thrown by the handler are swallowed.

A rejected publishable key (`401`/`403`) is reported once as
`{ kind: "auth", code: "AUTHENTICATION_FAILED" }` and pauses outbound traffic. Queued data is kept,
so fixing the key and relaunching delivers it. The pause is not permanent: one request is allowed
through every 60 s, and `init()` clears it outright. The first read that has _nothing_ cached to
answer with also fails once with an `AUTHENTICATION_FAILED` `VoidhashError`, so a wrong key in
development is impossible to miss; every later read answers from cache as usual.

## Unstable error swallowing

Deprecated. Transport failures no longer surface as errors, so there is nothing left for this flag
to swallow — use `onDiagnostic` to observe failures the SDK recovered from. The flag still works and
will be removed in a future release.

For early-alpha integrations, side-effect methods can log instead of rejecting:

```ts
createVoidhashClient("vh_pk_...", {
  scheme: "myapp",
  unstable_swallowErrors: true,
});
```

Swallowed (warn, return `Result.ok`): `init()`, `end()`, `identify(...)`, `reset()`, `signOut()`,
`setPersonAttributes(...)`, `restorePurchases()`, `iosPresentCodeRedemptionSheet()`,
`iosShowManageSubscriptions()`. `flush()` is no longer among them: it answers with delivery counts,
so a failure has to reach the caller.

Strict (return `Result.err` on failure): `getCurrentPerson(...)`, `getFeatureFlags(...)`,
`getPaywallForLocation(...)`, `getProducts()`, `hasPerk(...)`, `setPersonAttributesSync(...)`,
`purchase(...)`. In practice these no longer fail for transport reasons — they answer from cache
instead.

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

### Sessions

Every event carries a `session_id`. A session is a run of events with no gap longer than 30
minutes between them: the first capture after a longer gap, including `$app_opened` on a launch
after a long absence, starts a new session. The session is persisted, so it survives restarts and
resumes on the next launch when the timeout has not passed. `signOut()` records `$sign_out` in the
old session and then starts a new one. `voidhash.client.getSessionId()` returns the active session
id synchronously, or `undefined` before `init()` and once the session has timed out.

### Screen tracking

The SDK captures a built-in `$screen` event for every screen the user lands on. Each event carries
`$screen_name`, `$screen_path`, `$screen_source`, the previous screen (`$previous_screen_name`,
`$previous_screen_path`, `$previous_screen_duration_ms`) and, when the platform exposes one,
`$screen_title`. Route params are off by default; opt in with `screenTracking.includeParams` to add
`$screen_params` (string-coerced, at most 20 keys).

Expo Router: mount `ScreenTracking` once, below the provider in the root layout.

```tsx
import { ScreenTracking } from "@voidhash/react-native/expo-router";

export default function RootLayout() {
  return (
    <voidhash.Provider>
      <ScreenTracking />
      <Stack />
    </voidhash.Provider>
  );
}
```

React Navigation: pass the returned ref and callbacks to `NavigationContainer`. An existing ref can
be reused with `useScreenTracking({ ref })`.

```tsx
import { useScreenTracking } from "@voidhash/react-native/react-navigation";

function App() {
  const screenTracking = useScreenTracking();
  return (
    <NavigationContainer
      ref={screenTracking.ref}
      onReady={screenTracking.onReady}
      onStateChange={screenTracking.onStateChange}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}
```

Both subpaths keep `expo-router` and `@react-navigation/native` as optional peer dependencies.
Custom navigation reports screens by hand with `voidhash.client.screen("Onboarding/Step 2")`; every
call counts as a new screen. Rewrite or drop screens with `screenTracking.mapScreen` (return `null`
to skip) and turn the feature off with `screenTracking: { enabled: false }`.

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

## Migrating to the offline-first release

Behavior that changed. All of it removes a failure mode; none of it needs a flag.

- `init()` no longer rejects when the schema cannot be fetched. A first launch with no connectivity
  boots on an empty schema and fills it in once the network is back. Analytics, lifecycle events and
  identity never depended on the schema and are unaffected.
- `hasPerk(...)` is cache-first instead of refreshing on every call, and its two former `Err`
  branches are now typed `Ok` values carrying `reason: "no-cache" | "refresh-failed"`. `allowStale`
  is still accepted and no longer changes the outcome; pass `{ forceFetch: true }` when you
  deliberately want the server.
- `getCurrentPerson()` returns `{ person, isStale, isExpired }` rather than the bare snapshot, and
  `getFeatureFlags()` adds `isStale`.
- `setPersonAttributesSync(...)` returns `{ status: "confirmed" | "deferred", person }`. A
  `deferred` result means the server was unreachable and the update is queued.
- `flush()` returns `{ flushed, pending }` instead of `void`.
- `usePaywallByLocation(...).show()` can return `{ status: "unavailable" }` for a placement that has
  never been resolved on this device while the server is unreachable.
- `setPersonAttributesSync(...)` on a client created with `enabled: false` now answers
  `{ status: "disabled", person: null }` rather than `deferred` — nothing was recorded, and nothing
  is queued.
- Cached entries are now namespaced under `vh:<version>:<hash>:` in `AsyncStorage`, so the SDK can
  no longer collide with your app's own keys. Entries written by earlier releases are migrated into
  the namespace once, on the first launch after the upgrade: the distinct id, the person snapshot,
  the analytics session, the seen app release and the cached schema all carry over, so existing
  installs keep their identity and do not re-fire `$app_installed`.
- Call `identify` as early as you know the user: the SDK invalidates and refetches the per-person
  state for you.
