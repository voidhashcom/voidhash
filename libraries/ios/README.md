# @voidhash/ios

The Voidhash iOS SDK for entitlements, feature flags, analytics, and observer-mode transaction
reporting in bare Swift apps.

> **Initial release:** SDK-started purchases and hosted paywalls are temporarily unavailable. The
> SDK observes and submits StoreKit transactions to Voidhash for revenue analytics, but never
> finishes them. The host billing integration remains the transaction owner.

The package ships two library products:

- **`Voidhash`** — the SDK you integrate against (`Voidhash.configure(…)` → `VoidhashClient`).
- **`VoidhashCore`** — the shared native core (StoreKit engine, paywall bridge and presenter,
  API client, identity, caching, schema). Also consumed by `@voidhash/react-native`'s native
  layer; you only depend on it directly if you are building on top of the engine yourself.

Requirements: iOS 15+, Swift 6 toolchain (the sources build with Swift 5.9 language mode too).

## Offline behaviour

If Voidhash is down or the device is offline, the worst outcome for your app is delayed
analytics. Your app keeps working, entitlements, flags and paywalls are served from the last
known state, and no SDK call fails, throws, or blocks startup because the backend is
unreachable, slow, or returning 5xx.

Concretely:

- `waitForInitialization()` resolves from local state. With no cached schema and no connectivity
  it returns an empty schema and refreshes in the background; analytics capture and lifecycle
  tracking are already running by the time it returns.
- Reads are cache-first. `getCurrentPerson`, `getFeatureFlags` and `getPaywall` answer from the
  cache and refresh behind the read. A stale value waits at most 500 ms for the refresh before
  being returned as is; the refresh continues and lands for the next read.
- Cached values are served past their TTL. Use `getCurrentPersonState()`,
  `getFeatureFlagsState()` and `getPaywallState(location:)` to see `isStale` and `isExpired` when
  you gate high-value content.
- Captured events go to a persistent queue (cap 1000, oldest evicted first) and are removed only
  once the backend acknowledges them. Retries are unbounded with jittered exponential backoff.
- Store receipts go to a durable outbox before any network call and are retried until the backend
  accepts them, across relaunches.
- Requests time out after 10 s (30 s per resource), and a host that fails five times in a row is
  given a rest by a circuit breaker that probes again after 30 s. Coming back online, foregrounding
  the app and calling `flush()` all resume traffic immediately.
- A rejected publishable key pauses outbound traffic instead of burning the session on requests
  that can only fail. The queues are kept, and a probe a minute later resumes everything on its
  own once the key is accepted again, so a rotated key or a transient 403 needs no relaunch.
- `identify` and `setPersonAttributes` apply locally and queue the server call when the backend is
  unreachable, so the identity switch takes effect either way.

Set `options.preloadPlacements` to warm paywalls the app will show on its first launch;
placements the device has already resolved are remembered and preloaded on later launches, so a
`presentPaywall` for a known placement needs no network at all.

## Install

### Swift Package Manager

In Xcode: _File → Add Package Dependencies…_ and enter the repository URL
`https://github.com/voidhashcom/voidhash`, then add the **Voidhash** library to your app target.

In a `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/voidhashcom/voidhash", from: "0.0.1-alpha.1")
],
targets: [
    .target(name: "App", dependencies: [.product(name: "Voidhash", package: "voidhash")])
]
```

### CocoaPods

```ruby
pod "VoidhashCore", :path => "../node_modules/@voidhash/ios"
pod "Voidhash", :path => "../node_modules/@voidhash/ios"
```

`Voidhash` depends on `VoidhashCore`, and both podspecs live at the package root. A `:path` pod
is resolved from your `Podfile`, not from a spec repo, so declare **both** lines — CocoaPods
cannot find the local `VoidhashCore` from the `Voidhash` dependency alone. When you install the
SDK from npm (`npm install @voidhash/ios`) point both `:path`s at the installed package
directory as shown above; once the pods are published to trunk, `pod "Voidhash"` on its own
pulls the matching `VoidhashCore` version.

## Configure

```swift
import Voidhash

let voidhash = Voidhash.configure(publishableKey: "pk_live_…")
```

Options:

```swift
var options = VoidhashOptions()
options.baseUrl = URL(string: "https://api.voidhash.com")!  // API origin
options.ingestUrl = nil            // analytics ingest origin; defaults to baseUrl
options.debug = false              // SDK logging + `x-is-debug-build`
options.distinctId = nil           // start with your own id instead of an anonymous one
options.enabled = true             // false makes every call inert (no network at all)
options.readOnly = true            // forced on in the initial observer-only release
options.dev = false                // reserved for SDK-started test purchases
options.onWarning = { message in   // diagnostics that are never raised to the caller
    print(message)                 // defaults to the unified log
}
options.onDiagnostic = { event in  // structured version of the same, with a routing `kind`
    print("\(event.kind) \(event.code) \(event.operation): \(event.message)")
}
options.preloadPlacements = ["onboarding"]  // warm these paywalls on the first launch

let voidhash = Voidhash.configure(publishableKey: "pk_live_…", options: options)
```

`Voidhash.shared` returns the most recently configured client. Initialization (store
connection, schema fetch, reconciliation of transactions observed while the app was away) runs
in the background and is awaited implicitly by the first call that needs it; `await
voidhash.waitForInitialization()` waits for it explicitly.

## Products and transaction reporting

```swift
let products = try await voidhash.getProducts()

if let product = products.first(where: { $0.slug == "pro-monthly" }) {
    // Prices are already formatted for the customer's storefront.
    print(product.displayPrice, product.interval ?? "one-time")
}

// Reads StoreKit history, submits transactions to Voidhash, and refreshes the person.
try await voidhash.restorePurchases()
```

Initialization installs the StoreKit observer and reconciles existing transactions. Observed and
restored transactions are sent to `sync-transaction` with observer mode enabled, and are left
unfinished for the host billing integration.

`purchase(product:)` is retained for the upcoming commerce launch but currently throws
`READ_ONLY_PURCHASE_NOT_ALLOWED` before StoreKit is touched:

```swift
do {
    try await voidhash.purchase(product: product)
} catch let error as VoidhashStoreError
    where error.code == "READ_ONLY_PURCHASE_NOT_ALLOWED"
{
    // Use the host app's existing billing integration.
}
```

Passing `readOnly: false` or calling `setReadOnly(false)` cannot transfer StoreKit ownership to
Voidhash in this release. SDK-owned store sheets are also inert until commerce launches.

## People and entitlements

```swift
let person = try await voidhash.getCurrentPerson()
let isPro = person?.entitlements.grants.contains { $0.perkId == "pro" && $0.status == "active" }

try await voidhash.identify(externalUserId: "user_123", email: "ada@example.com", name: "Ada")
try await voidhash.setPersonAttributes(["plan": .string("pro"), "seats": .number(3)])

let distinctId = await voidhash.getDistinctId()
await voidhash.reset()  // sign out: clears the identity and every cached response
```

`getCurrentPerson(forceFetch: true)` bypasses the cached snapshot when the network is usable.
`getCurrentPersonState()` returns the same value alongside `isStale` and `isExpired`.

`identify` and `reset` invalidate the person and flag entries of the identity you are leaving, so
flags evaluated for the anonymous user never leak into the identified session. Call `identify` as
early as you know who the user is; the SDK refetches per-person state for you.

## Feature flags

```swift
let flags = try await voidhash.getFeatureFlags(["new-onboarding"])
let enabled = flags.first { $0.key == "new-onboarding" }?.enabled == true
```

Results are cached per identity for 5 minutes and served indefinitely while the backend is
unreachable, so a flag never falls back to its default during an outage. `getFeatureFlagsState()`
adds an `isStale` marker.

## Analytics

```swift
await voidhash.capture("checkout_started", properties: ["plan": .string("pro")])
await voidhash.flush()
```

Events are batched (20 per request, flushed every 5 seconds), persisted as they are captured and
retried with jittered exponential backoff until the backend acknowledges them. `flush()` sends
everything due right now and returns a `FlushStatus`:

```swift
let status = await voidhash.flush()
print(status.flushed, status.pending, status.lastError ?? "")
```

`flush()` never throws. An unreachable backend leaves the events on disk and reports them as
`pending`.

## Paywalls

Hosted paywalls are temporarily unavailable. Their compatibility surface remains in the package
for the upcoming launch, but it performs no network or presentation work:
`presentPaywall(...)` returns `.notAssigned`, paywall resolution returns `nil`, and
`dismissPaywall()` is a no-op.

## Migrating from 0.0.1-alpha.1

The offline-first release changes observable behaviour in seven places. None of them need a code
change unless you were relying on the old failure modes.

1. `waitForInitialization()` and `start()` no longer fail because the schema fetch failed. If you
   wrapped them in a `do/catch` to show an error screen on a cold, offline launch, remove it: the
   SDK now boots on cached or empty state and refreshes in the background. The call still
   `throws`, so existing `try` sites compile unchanged.
2. A failed store connection no longer fails initialization either. It is reported through
   `onWarning`/`onDiagnostic` and costs transaction observation for that launch, not the SDK.
3. `flush()` now returns a `FlushStatus` instead of `Void`. Existing `await voidhash.flush()`
   call sites compile unchanged because the result is discardable.
4. `PaywallPresentationResult` gained `.unavailable`, returned when no configuration for the
   placement is cached and the backend cannot be reached. `.failed` is now reserved for causes you
   can act on. Add a case to any exhaustive `switch`.
5. Cached entries are served past their TTL rather than discarded. If you treated a `nil` person
   as "signed out", read `getCurrentPersonState().isExpired` instead.

The persisted cache moved to a namespace derived from your publishable key and API origin, and
the schema entry moved from a per-app-version key to a single one. Both are migrated once, on the
first launch of the new version: the distinct id, the analytics session, the last seen app
release, the processed-transaction records and the cached schema are carried across, so an
upgrading device keeps its identity and does not re-report `$app_installed`. Nothing is required
of you.

## Test

```sh
swift test --package-path .
```

The whole package — including the StoreKit engine, the paywall bridge and the SDK client — is
testable on macOS; UIKit-only code paths are compiled out there.
