# @voidhash/ios

The Voidhash iOS SDK: in-app purchases, entitlements, paywalls, feature flags and analytics
for bare Swift apps.

The package ships two library products:

- **`Voidhash`** — the SDK you integrate against (`Voidhash.configure(…)` → `VoidhashClient`).
- **`VoidhashCore`** — the shared native core (StoreKit engine, paywall bridge and presenter,
  API client, identity, caching, schema). Also consumed by `@voidhash/react-native`'s native
  layer; you only depend on it directly if you are building on top of the engine yourself.

Requirements: iOS 15+, Swift 6 toolchain (the sources build with Swift 5.9 language mode too).

## Install

### Swift Package Manager

In Xcode: *File → Add Package Dependencies…* and enter the repository URL
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
options.readOnly = false           // observer mode: sync transactions, never finish them
options.onWarning = { message in   // diagnostics that are never raised to the caller
    print(message)                 // defaults to the unified log
}

let voidhash = Voidhash.configure(publishableKey: "pk_live_…", options: options)
```

`Voidhash.shared` returns the most recently configured client. Initialization (store
connection, schema fetch, reconciliation of transactions observed while the app was away) runs
in the background and is awaited implicitly by the first call that needs it; `await
voidhash.waitForInitialization()` waits for it explicitly.

## Products and purchases

```swift
let products = try await voidhash.getProducts()

if let product = products.first(where: { $0.slug == "pro-monthly" }) {
    // Prices are already formatted for the customer's storefront.
    print(product.displayPrice, product.interval ?? "one-time")
    try await voidhash.purchase(product: product)
}

try await voidhash.restorePurchases()
```

`purchase(product:)` buys through StoreKit 2, syncs the transaction to Voidhash and only then
finishes it with the store. Failures surface as `VoidhashStoreError`, whose string form is
`"CODE: message"` — `USER_CANCELLED`, `PURCHASE_PENDING`, `INVALID_PRODUCT_ID`, …:

```swift
do {
    try await voidhash.purchase(product: product)
} catch let error as VoidhashStoreError where error.code == "USER_CANCELLED" {
    // The customer dismissed the store sheet.
}
```

Observer mode (you own the purchase code, Voidhash only records it) can be toggled at runtime:

```swift
await voidhash.setReadOnly(true)
```

A purchase that started while the SDK owned the flow is still finished with the store even if
the flag flips mid-flight.

Store sheets:

```swift
try await voidhash.presentCodeRedemptionSheet()
try await voidhash.showManageSubscriptions()
```

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

```swift
final class Paywalls: VoidhashPaywallDelegate {
    func paywall(_ location: String, didPurchaseProductId productId: String, requestId: String?) {
        // Unlock the feature.
    }

    func paywallDidDismiss(_ location: String) {}
}

// From a view controller — `from:` is optional and defaults to the key window's top controller.
let result = try await voidhash.presentPaywall(
    location: "onboarding",
    from: self,
    delegate: paywallsDelegate
)

switch result {
case .shown: break
case .notAssigned: break   // no published paywall for this location
case .failed: break        // the presenter declined to present
}
```

The delegate is held weakly, so keep your own strong reference to it for as long as the paywall
is presented — every method has a default no-op implementation, and a released delegate simply
stops receiving callbacks.

The SDK resolves the paywall assigned to the location, presents it in a full-screen WebView and
speaks the paywall bridge protocol on your behalf: purchases and restores started inside the
paywall run through the same purchase pipeline, `close` dismisses it, external links open in the
browser, and custom bundle events are captured into analytics. Dismiss it yourself with
`try await voidhash.dismissPaywall()`.

## Test

```sh
swift test --package-path .
```

The whole package — including the StoreKit engine, the paywall bridge and the SDK client — is
testable on macOS; UIKit-only code paths are compiled out there.
