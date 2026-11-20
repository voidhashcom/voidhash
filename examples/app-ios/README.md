# app-ios

Nimbus, the notes app from the [examples spec](../README.md), built as a bare SwiftUI app on
the [iOS SDK](../../libraries/ios). Free accounts keep 3 notes; Pro is unlimited and can
export. Three tabs, one `VoidhashClient`, no other dependencies.

Nimbus buys through the SDK, which syncs each purchase with Voidhash and finishes it with the App
Store. Paywalls and flows are drawn natively by the `VoidhashUI` package.

## What it demonstrates

- **Configuring the SDK once** and holding the client in an app-state model
  ([`AppModel.swift`](Nimbus/Model/AppModel.swift)) that every screen reads from.
- **SDK-owned purchases.** The app buys with `purchase(product:)`. The SDK syncs the transaction
  with Voidhash and finishes it, and does the same for the transactions StoreKit delivers later:
  renewals, approved Ask to Buy requests and purchases made on another device. The app never
  touches StoreKit transactions itself.
- **Presenting a flow and handling how it ended.** `presentFlow(location:)` returns when the
  flow ends, with its `outcome` (`purchased`, `restored`, `dismissed`, or the outcome the flow
  finished with) and its `output`, and throws a `FlowError` when nothing could be shown. A
  project with no published paywall throws `FlowError.notAssigned` — the normal state on day
  one, not an error — and the app quietly falls back to its own Upgrade tab.
  The flow is drawn by the `VoidhashUI` renderer, which the SDK finds once the app links it. A
  purchase tapped on it runs through the same SDK purchase, and a paywall then ends with
  `.purchased`.
- **Granting flow capabilities.** `options.flowCapabilities = [.links, .notifications,
.attributes]` lets the onboarding flow open links, ask for notification permission and save
  its answers as person attributes. Anything not granted is refused.
- **Errors that are not failures.** A cancelled purchase or App Store sign-in is silent, a
  purchase waiting for approval gets its own message, everything else is shown.
- **A real failure state.** If the first round-trip fails the app renders the reason and a
  retry button instead of an empty screen.

## Prerequisites

- Xcode 16 or newer (the SDK needs a Swift 6 toolchain; the app targets iOS 15).
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) — `brew install xcodegen`.
- A Voidhash project and its **publishable key**. Debug builds in development mode need the
  test key (`vh_pk_test_…`); a release build uses the production key (`vh_pk_…`)
  ([API keys](https://voidhash.com/docs/setup/environments#api-keys)).

## Run it

```sh
cp Config/Secrets.xcconfig.example Config/Secrets.xcconfig
# paste your vh_pk_test_… key into Config/Secrets.xcconfig
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

### A local backend

`Config/Nimbus.xcconfig` also defines `VOIDHASH_API_BASE_URL` (empty, the production API) and
`VOIDHASH_DEVELOPMENT_MODE` (`NO`). Set them in `Config/Secrets.xcconfig` to run against a local
backend, with development-mode products so a simulator shows prices and buys them without App
Store setup:

```
VOIDHASH_API_BASE_URL = http:/$()/127.0.0.1:8788
VOIDHASH_DEVELOPMENT_MODE = YES
```

(`//` starts a comment in an xcconfig; `$()` keeps it out of the URL.)

### The SDK dependency

This example points at the SDK sources next to it in the repository:

```yaml
packages:
  Voidhash:
    path: ../../libraries/ios
```

In your own app, use the package from the repository at an exact release instead:

```yaml
packages:
  Voidhash:
    url: https://github.com/voidhashcom/voidhash
    exactVersion: 0.1.2
```

or, in Xcode, _File → Add Package Dependencies…_ with
`https://github.com/voidhashcom/voidhash` and the rule _Exact Version_.

The target links three products: `Voidhash` is the SDK, `VoidhashCore` carries the wire model
types its public API hands back (`SdkPerson`, `SdkEntitlementGrant`, `JSONValue`,
`VoidhashStoreError`), and `VoidhashUI` draws flows. Any app that reads a person or branches on an
error code needs the first two. All three come from the one `Voidhash` package, which this
example takes at an exact release, as an app does (`project.yml`).

## Test purchases

Buying needs products the App Store knows. Create them in App Store Connect with the IDs you
connect to the Voidhash products, connect App Store Connect to your Voidhash project, and run
Nimbus on a device signed into a Sandbox Apple account. Voidhash verifies each purchase with the
App Store and grants the `pro` perk attached to the product, and the Account tab shows it.

A local StoreKit configuration file in Xcode lets a purchase complete on a simulator, but the
SDK does not send such purchases to Voidhash, because the App Store cannot verify them. It
reports the skip as the `STOREKIT_TESTING_TRANSACTION_SKIPPED` diagnostic.

## The screens

### Notes — [`NotesScreen.swift`](Nimbus/Screens/NotesScreen.swift)

The note list, a banner reading "2 of 3 notes left", and two buttons.

| Action                     | SDK call                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| New note                   | `capture("note_created", properties:)`, then `setPersonAttributes(["plan":, "notes_created":])` |
| New note at the free limit | `presentFlow(location: "onboarding")`                                                           |
| Export (Pro only)          | `capture("export_requested")`, then `presentFlow(…)` when the person has no `pro` grant         |

Every outcome is handled, and every failure ends up on the Upgrade tab with a one-line
explanation:

```swift
do {
    let result = try await client.presentFlow(location: "onboarding")
    switch result.outcome {
    case FlowResult.purchased, FlowResult.restored: await refreshPerson()
    case FlowResult.dismissed:                      break
    default:                                        notice = …  // the flow's own outcome
    }
} catch FlowError.notAssigned {
    fallBackToUpgradeTab("No paywall is available for “onboarding”…")
} catch FlowError.unavailable {
    fallBackToUpgradeTab("Voidhash is unreachable and this paywall was never loaded…")
} catch {
    fallBackToUpgradeTab("The paywall could not be presented…")
}
```

Nimbus uses the overload without a `from:` view controller, which presents from the key
window's top controller — the right choice in SwiftUI, where there is no view controller to
hand over. UIKit apps can pass one.

### Upgrade — [`UpgradeScreen.swift`](Nimbus/Screens/UpgradeScreen.swift)

The app's own upgrade screen, and the fallback whenever the paywall cannot be shown.

| Action               | Call                                                     |
| -------------------- | -------------------------------------------------------- |
| Product list         | `getProducts()` (loaded once at launch)                  |
| Buy                  | `capture("checkout_started")`, then `purchase(product:)` |
| Restore purchases    | `restorePurchases()`                                     |
| Manage subscriptions | StoreKit's `manageSubscriptionsSheet(isPresented:)`      |

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

Pro is one check of the perk slug set in Studio, and it is the only gate in the app:

```swift
person.hasActivePerk("pro")
```

## What to steal for your own app

- [`Nimbus/Model/AppModel.swift`](Nimbus/Model/AppModel.swift) — the whole integration. The
  SDK purchase with its pending-approval message, the `presentUpgrade(reason:)` fallback, the
  `run(_:)` helper that swallows cancellations, and `describe(_:)`, which unwraps
  `VoidhashStoreError`, `VoidhashApiError` and `FailedToFetchSchemaError` into a sentence worth
  showing a person.
- [`Nimbus/App/NimbusConfiguration.swift`](Nimbus/App/NimbusConfiguration.swift) and
  [`Config/Nimbus.xcconfig`](Config/Nimbus.xcconfig) — keys out of source control without a
  build script.
- [`project.yml`](project.yml) — a reviewable Xcode project, including how to swap the local
  package for the published one.

Notes live in memory and disappear on relaunch. Everything Voidhash-shaped is real.
