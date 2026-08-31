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

`getCurrentPerson(forceFetch: true)` bypasses the cached snapshot.

## Feature flags

```swift
let flags = try await voidhash.getFeatureFlags(["new-onboarding"])
let enabled = flags.first { $0.key == "new-onboarding" }?.enabled == true
```

## Analytics

```swift
await voidhash.capture("checkout_started", properties: ["plan": .string("pro")])
await voidhash.flush()
```

Events are batched (20 per request, flushed every 5 seconds) and retried with exponential
backoff; `flush()` sends everything queued right now.

## Paywalls

Hosted paywalls are temporarily unavailable. Their compatibility surface remains in the package
for the upcoming launch, but it performs no network or presentation work:
`presentPaywall(...)` returns `.notAssigned`, paywall resolution returns `nil`, and
`dismissPaywall()` is a no-op.

## Test

```sh
swift test --package-path .
```

The whole package — including the StoreKit engine, the paywall bridge and the SDK client — is
testable on macOS; UIKit-only code paths are compiled out there.
