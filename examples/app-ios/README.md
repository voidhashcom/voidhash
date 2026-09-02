# app-ios

Nimbus, the notes app from the [examples spec](../README.md), built as a bare SwiftUI app on
[`@voidhash/ios`](../../libraries/ios). Free accounts keep 3 notes; Pro is unlimited and can
export. Three tabs, one `VoidhashClient`, no other dependencies.

## What it demonstrates

- **Configuring the SDK once** and holding the client in an app-state model
  ([`AppModel.swift`](Nimbus/Model/AppModel.swift)) that every screen reads from.
- **Development mode.** `options.dev = true` inside `#if DEBUG`, so a purchase completes on a
  bare simulator with no App Store Connect setup.
- **Presenting a paywall and surviving the answer.** `presentPaywall(location:delegate:)`
  returns `.shown`, `.notAssigned` or `.failed`. A project with no published paywall answers
  `.notAssigned` — the normal state on day one, not an error — and the app quietly falls back
  to its own Upgrade tab.
- **A paywall delegate held strongly.** The SDK keeps the delegate weakly; `AppModel` owns the
  only strong reference and releases it when the paywall reports that it was dismissed.
- **Errors that are not failures.** `VoidhashStoreError.code == "USER_CANCELLED"` is silent,
  `PURCHASE_PENDING` gets its own message, everything else is shown.
- **A real failure state.** If the first round-trip fails the app renders the reason and a
  retry button instead of an empty screen.

## Prerequisites

- Xcode 16 or newer (the SDK needs a Swift 6 toolchain; the app targets iOS 15).
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) — `brew install xcodegen`.
- A Voidhash project and its **publishable key** (`vh_pk_…`).

## Run it

```sh
cp Config/Secrets.xcconfig.example Config/Secrets.xcconfig
# paste your vh_pk_… key into Config/Secrets.xcconfig
xcodegen generate && open NimbusExample.xcodeproj
```

Then run the `NimbusExample` scheme on any simulator.

`NimbusExample.xcodeproj` is build output — [`project.yml`](project.yml) is the source of
truth and the generated project is git-ignored. Re-run `xcodegen generate` after adding a file.

### The publishable key

`Config/Nimbus.xcconfig` defines `VOIDHASH_PUBLISHABLE_KEY` (empty) and optionally includes
`Config/Secrets.xcconfig`, which is git-ignored. The value lands in `Info.plist` as
`VoidhashPublishableKey` and is read at launch by
[`NimbusConfiguration`](Nimbus/App/NimbusConfiguration.swift). Until you set it the app shows
a screen telling you so rather than configuring the SDK with an empty string.

### The SDK dependency

This example points at the SDK sources next to it in the repository:

```yaml
packages:
  Voidhash:
    path: ../../libraries/ios
```

In your own app, use the published package instead:

```yaml
packages:
  Voidhash:
    url: https://github.com/voidhashcom/voidhash
    from: 0.0.1-alpha.1
```

or, in Xcode, _File → Add Package Dependencies…_ with
`https://github.com/voidhashcom/voidhash`.

The target links **two** products: `Voidhash` is the SDK, and `VoidhashCore` carries the wire
model types its public API hands back (`SdkPerson`, `SdkEntitlementGrant`, `JSONValue`,
`VoidhashStoreError`). Any app that reads a person or branches on an error code needs both.

## Development mode

In a debug build the client is configured with `options.dev = true`:

```swift
var options = VoidhashOptions()
#if DEBUG
    options.debug = true
    options.dev = true
#endif
client = Voidhash.configure(publishableKey: publishableKey, options: options)
```

Products are then synthesized from the dashboard's development metadata instead of the App
Store, buying one shows a "Test purchase" confirmation sheet, and the resulting purchase is
recorded under the development environment so it never mixes with production data. Nothing is
charged and no App Store Connect or StoreKit configuration file is involved. Release builds
ignore the flag entirely — the mock store is not compiled into them.

## The screens

### Notes — [`NotesScreen.swift`](Nimbus/Screens/NotesScreen.swift)

The note list, a banner reading "2 of 3 notes left", and two buttons.

| Action                     | SDK call                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| New note                   | `capture("note_created", properties:)`, then `setPersonAttributes(["plan":, "notes_created":])` |
| New note at the free limit | `presentPaywall(location: "onboarding", delegate:)`                                             |
| Export (Pro only)          | `capture("export_requested")`, then `presentPaywall(…)` when the person has no `pro` grant      |

The paywall result is handled exhaustively, and both non-`shown` cases end up on the Upgrade
tab with a one-line explanation:

```swift
switch try await client.presentPaywall(location: "onboarding", delegate: relay) {
case .shown:       break
case .notAssigned: fallBackToUpgradeTab("No paywall is published for “onboarding” yet…")
case .failed:      fallBackToUpgradeTab("The paywall could not be presented…")
}
```

Nimbus uses the overload without a `from:` view controller, which presents from the key
window's top controller — the right choice in SwiftUI, where there is no view controller to
hand over. UIKit apps can pass one.

### Upgrade — [`UpgradeScreen.swift`](Nimbus/Screens/UpgradeScreen.swift)

The app's own upgrade screen, and the fallback whenever the paywall cannot be shown.

| Action               | SDK call                                                 |
| -------------------- | -------------------------------------------------------- |
| Product list         | `getProducts()` (loaded once at launch)                  |
| Buy                  | `capture("checkout_started")`, then `purchase(product:)` |
| Restore purchases    | `restorePurchases()`                                     |
| Redeem an offer code | `presentCodeRedemptionSheet()`                           |
| Manage subscriptions | `showManageSubscriptions()`                              |

An empty product list is presented as "no products yet" with the slugs to create, because that
is what an unconfigured project legitimately returns.

### Account — [`AccountScreen.swift`](Nimbus/Screens/AccountScreen.swift)

| Action                  | SDK call                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| Sign in                 | `identify(externalUserId:email:name:)`                                   |
| Write attributes        | `setPersonAttributes(["plan": .string(…), "notes_created": .number(…)])` |
| Entitlement grants      | `getCurrentPerson(forceFetch: true)` → `person.entitlements.grants`      |
| `nimbus-new-onboarding` | `getFeatureFlags(["nimbus-new-onboarding"])`                             |
| Sign out                | `flush()`, then `reset()`                                                |

Pro is one predicate over the grants, and it is the only gate in the app:

```swift
person.entitlements.grants.contains { $0.perkId == "pro" && $0.status == "active" }
```

## What to steal for your own app

- [`Nimbus/Model/AppModel.swift`](Nimbus/Model/AppModel.swift) — the whole integration. The
  `presentUpgrade(reason:)` fallback, the `run(_:)` helper that swallows `USER_CANCELLED`, and
  `describe(_:)`, which unwraps `VoidhashStoreError`, `VoidhashApiError` and
  `FailedToFetchSchemaError` into a sentence worth showing a person.
- [`Nimbus/Model/PaywallEventRelay.swift`](Nimbus/Model/PaywallEventRelay.swift) — a
  `VoidhashPaywallDelegate` that forwards to one closure. Copy the ownership rule with it: the
  SDK holds it weakly, so it must be stored somewhere that outlives the paywall.
- [`Nimbus/App/NimbusConfiguration.swift`](Nimbus/App/NimbusConfiguration.swift) and
  [`Config/Nimbus.xcconfig`](Config/Nimbus.xcconfig) — keys out of source control without a
  build script.
- [`project.yml`](project.yml) — a reviewable Xcode project, including how to swap the local
  package for the published one.

Notes live in memory and disappear on relaunch. Everything Voidhash-shaped is real.
