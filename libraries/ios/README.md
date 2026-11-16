# @voidhash/ios

The Voidhash iOS SDK: in-app purchases, entitlements, paywalls and flows, feature flags and
analytics for bare Swift apps.

By default the SDK owns purchases: it starts them, syncs them with Voidhash and finishes them with
StoreKit. An app whose existing billing SDK owns purchases can run it in observer mode instead
(see [Observer mode](#observer-mode)). Paywalls and flows are drawn by the native `VoidhashUI`
renderer (see [Paywalls and flows](#paywalls-and-flows)).

The package ships two library products:

- **`Voidhash`** — the SDK you integrate against (`Voidhash.configure(…)` → `VoidhashClient`).
- **`VoidhashCore`** — the shared native core (StoreKit engine, API client, identity, caching,
  schema). Also consumed by `@voidhash/react-native`'s native
  layer. It defines the model and error types the SDK returns, such as `SdkPerson` and
  `VoidhashStoreError`: depend on it directly when your code names one of them.

Requirements: iOS 15+, Swift 6 toolchain (the sources build with Swift 5.9 language mode too). The
sources also build for visionOS and for app extensions (see [App extensions](#app-extensions)).

## Offline behaviour

Initialization and cached reads tolerate an unreachable backend. Entitlements, flags and paywalls
use the last known state while analytics and supported writes wait for delivery. Without cached
data, reads return their documented empty or unavailable results; purchases still require a usable
store connection. Invalid inputs, rejected operations and operations without a safe fallback can
still report errors. Offline state is not guaranteed to reflect the latest server state.

Concretely:

- `waitForInitialization()` resolves from local state. With no cached schema and no connectivity
  it returns an empty schema and refreshes in the background; analytics capture and lifecycle
  tracking are already running by the time it returns. A schema that could not be fetched, or was
  fetched for an earlier app version, is fetched again when the app returns to the foreground or
  connectivity comes back. `getProducts()` on an empty schema asks for it, but not while the
  backend is known to be down or refuses the key: it returns an empty list at once then.
- Initialization does not wait for backend or store connections, even on a cold online launch.
  The initial schema may be empty; background refresh updates subsequent operations.
- A request for selected flags can reuse the same identity's cached full evaluation. Stale
  evaluations remain available offline; a subset never stands in for the full evaluation.
- Reads are cache-first. `getCurrentPerson`, `getFeatureFlags` and `getPaywall` answer from the
  cache and refresh behind the read. A stale value waits at most 500 ms for the refresh before
  being returned as is; the refresh continues and lands for the next read.
- A flag read with nothing cached waits at most `featureFlags.maxWaitMilliseconds` (2 s). Without
  an answer by then it returns no flags, marked stale and expired, apart from the requested keys
  that have a `featureFlags.defaults` entry; the evaluation carries on in the background, is
  cached, and is announced through `featureFlags.onUpdate`. A launch with nothing cached against
  a slow backend therefore reads the defaults after 2 s instead of waiting for the evaluation;
  read the flags again when `onUpdate` reports it. A person or paywall read with nothing cached
  waits for the backend up to the request timeout.
- A read an open circuit breaker turned away is refreshed once the breaker lets a request through
  again, so `featureFlags.onUpdate` reports the flags as soon as Voidhash is back.
- Cached values are served past their TTL. Use `getCurrentPersonState()`,
  `getFeatureFlagsState()` and `getPaywallState(location:)` to see `isStale` and `isExpired` when
  you gate high-value content.
- A read whose refresh failed serves its cached value without asking again until a backoff has
  passed: the server's `Retry-After` when it sent one, otherwise up to a minute.
- `getCurrentPerson()` returns `nil` only when the backend answers that the identity has no person.
  That answer is cached like a snapshot, so later reads within 5 minutes make no request. An
  error page from anything in front of the backend keeps the cached person.
- Failures are sorted into three kinds. Transport errors, `408`, `425`, `429`, every `5xx`, and a
  `4xx` that is not a tagged Voidhash error (a proxy, firewall or edge page, `401` and `403`
  included) are temporary: data is kept and retried. A `401`/`403` that Voidhash itself answered
  means the publishable key was rejected and pauses traffic (see below). Any other tagged Voidhash
  error is final.
- Captured events go to a persistent queue (cap 1000, oldest evicted first) and are removed only
  once the backend acknowledges them. Evictions are reported as the `ANALYTICS_EVENT_DROPPED`
  diagnostic and a warning with their count, at most once a minute, and once more when the client is
  retired. Retries are unbounded with jittered exponential backoff (at most 37.5 s apart), or wait
  for the server's `Retry-After`, read from the header first and the body's `retry_after_ms` second,
  between 1 s and 30 s. A flush sends at most 10 batches, so after an outage a backlog drains over a
  few flush intervals rather than every device sending all of it the moment Voidhash is back. The
  backend refuses a whole batch when one of its events is invalid; the SDK then splits the batch
  until that event is alone, drops only it and delivers the rest. Non-finite numbers in properties
  are sent as `null`.
- Store receipts go to a durable outbox before any network call and are retried until the backend
  accepts them, across relaunches. While the app is in the foreground a failed delivery is retried
  on its own timer once its backoff, or the circuit breaker's cooldown, is over. Receipts have their
  own circuit breaker, so failing receipt deliveries never hold up entitlement and flag reads, and
  failing reads never hold up receipts. When Voidhash answers a receipt with `Retry-After`, every
  queued receipt waits until the time it gave, one from a purchase made meanwhile included; only a
  restore the user asks for is sent before it. A receipt Voidhash refuses for good (the store is not
  configured for the app, or the App Store does not know the transaction) is kept but parked: it
  is sent again on the next launch, after 6 hours or when the user restores purchases, and reported
  once as the `TRANSACTION_REJECTED` diagnostic.
- `identify` and `setPersonAttributes` apply locally first, so the identity switch takes effect
  either way. Their server calls are written to a durable queue before the request goes out and are
  retried until the backend applies them, across relaunches: an outage, a rejected key, a cancelled
  caller or a killed process never loses the link between an anonymous id and the account. Queued
  identify calls and traits are sent before queued receipts, so a purchase made anonymously lands
  after the merge. Both calls wait on Voidhash for at most 2 s and then return `deferred` while the
  request carries on. They are never evicted to make room; one is dropped only when the backend
  rejects it with a tagged error, reported as the `PERSON_WRITE_REJECTED` diagnostic.
- Requests time out after 10 s in total; flow package and paywall image downloads after 60 s. A
  flow that is not ready to show within 15 s of `presentFlow` is not shown, and its download
  carries on for the next presentation (see [Paywalls and flows](#paywalls-and-flows)). Each
  plane (reads and writes, analytics, receipts) has its own circuit breaker: five temporary failures
  in a row give the host a rest, and the breaker probes again after 30 s plus up to a quarter of
  that at random, doubling up to 5 minutes. Tagged Voidhash errors, rejected keys and requests that
  fail because the device has no network never count towards it. Coming back online, foregrounding
  the app and calling `flush()` all resume traffic immediately: the breaker gets its probe at once,
  and queued identify calls, traits, receipts and events are sent without waiting out the retry
  backoff. A server's `Retry-After` still holds.
- The SDK's requests share nothing with your app's own networking. They store and send no
  cookies and use no stored credentials, and API responses are never written to
  `URLCache.shared`. Paywall images and flow packages are cached under the usual HTTP rules in a
  cache of the SDK's own (up to 50 MB on disk, in the app's Caches directory), so showing a
  paywall does not depend on how your app configures `URLCache.shared`. The SDK also keeps the
  images a flow shows on the device itself, whatever their host's caching headers say, so a
  flow you have shown or preloaded has its images while that host is unreachable (see
  [Paywalls and flows](#paywalls-and-flows)).
- Retry deadlines survive a change of the device date: a date set back never parks queued data
  for longer than an hour, and cooldowns run on a clock the date does not affect.
- A rejected publishable key pauses outbound traffic instead of burning the session on requests
  that can only fail, and is reported once per pause as the `AUTHENTICATION_FAILED` diagnostic.
  The queues are kept. While the app is in the foreground the SDK sends one probe request a
  minute; a foreground, reconnect or `flush()` probes too once a minute has passed since the last
  one. The probe that finds the key accepted again resumes everything and sends what was held, so
  a rotated key needs no relaunch. Only an answer of Voidhash's own counts: a page from a proxy or
  a maintenance screen, even one sent with `200`, leaves the pause to the next probe. Configuring the SDK again, `identify`, `reset` and `signOut`
  lift the pause at once. A `401` or `403` from anything in front of Voidhash never pauses
  traffic: that request is retried like any other temporary failure and counts towards its
  plane's circuit breaker.
- Periodic work stops in the background: the 5-second analytics flush and the recovery timers
  stop when the app is backgrounded and resume when it returns. Backgrounding writes the queue
  through and, under a background task, sends queued identify calls and traits, receipts and
  events once.
- `flush()` and `syncPendingWork()` wait on Voidhash for at most 2 s; what is not delivered by then
  stays queued and keeps going in the background. `purchase(_:options:)` waits for its receipt for
  at most one request timeout after the store has charged the customer: the receipt then stays
  queued and the transaction unfinished until Voidhash accepts it.

Diagnostics keep their codes across releases so routing on them stays stable. The Android SDK
uses the same codes; where the web SDK reports the same situation under another code, the iOS code
maps as follows:

| iOS code                                                                     | Web code                 |
| ---------------------------------------------------------------------------- | ------------------------ |
| `CIRCUIT_OPEN` (when a breaker opens)                                        | `CIRCUIT_OPENED`         |
| `NETWORK_ERROR`, `API_ERROR`, `RATE_LIMIT_EXCEEDED`, `ANALYTICS_SEND_FAILED` | `TRANSPORT_FAILED`       |
| `PERSON_WRITE_REJECTED`                                                      | `IDENTITY_WRITE_REFUSED` |
| `QUEUE_WRITE_FAILED`                                                         | `CACHE_WRITE_FAILED`     |

`ANALYTICS_EVENT_DROPPED`, `AUTHENTICATION_FAILED` and `ANALYTICS_CONSENT_DENIED` are the same in
every SDK, and every diagnostic's `kind` (`transport`, `eviction`, `breaker`, `auth`, `cache`,
`consent`, `store`) routes the same way.

`options.preloadPlacements` is inert unless a native paywall renderer is configured: without one
the SDK resolves, remembers and warms no placement, so it makes no paywall request and downloads
no flow package.

## Install

### Swift Package Manager

In Xcode: _File → Add Package Dependencies…_, enter the repository URL
`https://github.com/voidhashcom/voidhash`, set the dependency rule to the `main` branch, and add
the **Voidhash** library to your app target. Add **VoidhashCore** as well when your code names its
types, such as `SdkPerson` or `VoidhashStoreError`, and `import VoidhashCore` where it does.

In a `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/voidhashcom/voidhash", branch: "main")
],
targets: [
    .target(
        name: "App",
        dependencies: [
            .product(name: "Voidhash", package: "voidhash"),
            .product(name: "VoidhashCore", package: "voidhash"),
        ]
    )
]
```

The repository has no release tags yet, so the dependency follows the `main` branch. Pin a commit
with `revision:` when you need a reproducible build, and switch to `from:` with a version once
releases are tagged.

### CocoaPods

The pods are not published to the CocoaPods trunk. Install the npm package
(`npm install @voidhash/ios`) and point both pods at it:

```ruby
pod "VoidhashCore", :path => "../node_modules/@voidhash/ios"
pod "Voidhash", :path => "../node_modules/@voidhash/ios"
```

`Voidhash` depends on `VoidhashCore`, and both podspecs live at the package root. A `:path` pod
is resolved from your `Podfile`, not from a spec repo, so declare **both** lines — CocoaPods
cannot find the local `VoidhashCore` from the `Voidhash` dependency alone.

## Configure

Configure the SDK once, while the app launches. In a SwiftUI app, do it in the `App` initializer:

```swift
import SwiftUI
import Voidhash

@main
struct MyApp: App {
    init() {
        Voidhash.configure(publishableKey: "vh_pk_…")
    }

    var body: some Scene {
        WindowGroup { ContentView() }
    }
}
```

Release builds use the production `vh_pk_…` key, including the build you test through TestFlight
and submit to App Review: their purchases are store sandbox purchases, which unlock access by
default. Debug builds in development mode, and internal builds that run against staging, use the test
`vh_pk_test_…` key. See
[API keys](https://voidhash.com/docs/concepts/api-keys).

In a UIKit app, call it from `application(_:didFinishLaunchingWithOptions:)`. Everywhere else,
use the configured client:

```swift
guard let voidhash = Voidhash.shared else { return }
```

Do not configure it in a `let` at file scope. Swift creates such a global the first time code
reads it, not at launch, so transaction observation, lifecycle events and screen tracking would
not start until then.

Options:

```swift
var options = VoidhashOptions()
options.baseUrl = URL(string: "https://api.voidhash.com")!  // API origin
options.ingestUrl = nil            // analytics ingest origin; defaults to baseUrl
options.debug = false              // SDK logging; also marks requests as a debug build
options.distinctId = nil           // start with your own id (see People); blank is ignored
options.enabled = true             // false makes the SDK fully inert (see below)
options.readOnly = false           // observer mode: sync transactions, never finish them
options.dev = false                // development mode (debug builds only, see below)
options.onWarning = { message in   // diagnostics that are never raised to the caller
    print(message)                 // defaults to the unified log
}
options.onDiagnostic = { event in  // structured version of the same, with a routing `kind`
    print("\(event.kind) \(event.code) \(event.operation): \(event.message)")
}
options.automaticLifecycleEvents = true  // $app_* and $sign_out events; see Analytics
options.analyticsConsent = .granted      // .denied or .pending collects no analytics; see Consent
options.analyticsWhilePending = .drop    // .buffer holds events until the decision; see Consent
options.grantConsentOnIdentify = false   // true: signing in grants a pending consent; see Consent
options.installAttribution = true        // credit new installs to Apple Ads; see Install attribution
options.featureFlags.maxWaitMilliseconds = 2000  // longest an uncached flag read waits
options.featureFlags.defaults = ["new-onboarding": false]  // flags without an evaluated value
options.featureFlags.onUpdate = { keys, flags in }  // an evaluation was cached; read flags again

Voidhash.configure(publishableKey: "vh_pk_…", options: options)
```

The SDK keeps its on-device state separately for each publishable key and API origin: the
identity, the analytics queue, queued receipts, identify calls and traits, and cached responses.
A different key or `baseUrl` (compared as written, so adding a trailing slash counts) starts with
fresh state: a new anonymous identity and empty queues. Nothing still queued under the previous
configuration is carried over or sent. Keep both stable across app updates. After changing one,
identify signed-in users again; anonymous purchasers get their access back by restoring
purchases, subject to your project's paid access sharing setting.

`Voidhash.shared` returns the most recently configured client. Initialization (store
connection, schema fetch, reconciliation of transactions observed while the app was away) runs
in the background and is awaited implicitly by the first call that needs it; `await
voidhash.waitForInitialization()` waits for it explicitly.

With `enabled: false` the SDK is fully inert: it makes no requests, opens no StoreKit
connection, starts no timers or lifecycle observers, installs no screen-tracking swizzle and
writes nothing to storage. Every method returns its inert value: `getProducts()` returns an empty
list, `getCurrentPerson()` returns `nil`, and `getDistinctId()` returns an anonymous id that is
never persisted or sent.

The publishable key is optional. Without one, `nil` or blank, the client is inert in the same way,
so a build that has no key, such as a local or preview build, configures the SDK and calls it like
any other:

```swift
Voidhash.configure(publishableKey: ProcessInfo.processInfo.environment["VOIDHASH_KEY"])
```

Calling `configure` again replaces the shared client. The previous client is retired: its StoreKit
observer and background work stop, and its queued events and transactions are handed over to the
new client. A reference you kept to the old client stays safe to call. Writes such as `capture`,
`identify` and `reportTransaction` go to the new client when it uses the same publishable key and
API origin, and reads return the inert values of a disabled client.

`VoidhashClient(publishableKey:options:)` creates a client without starting it. Call `start()` or
`waitForInitialization()` on it yourself, or prefer `Voidhash.configure`, which does both. One
client at a time works over the stored state of a publishable key and API origin: creating another
one for the same pair, directly or through `configure`, retires the previous client the same way
reconfiguring does. Create one client and keep it, rather than one per view or view model.

If iOS launches your app in the background after a reboot, before the device was first unlocked,
the SDK cannot read its stored state yet. It waits for the unlock instead of starting a new
identity: until then reads return empty, stale values without waiting, and captures, identify
calls and reported transactions are kept in memory and applied once the device is unlocked. At
most the 100 most recent captures are kept; identify calls and transactions always are.
The same applies to every background launch on a locked device when your app's data protection
entitlement is `NSFileProtectionComplete`, which makes `UserDefaults` unreadable while locked.
The first such launch after updating the SDK or clearing your app's `UserDefaults` also waits for
the unlock when nothing the SDK stored can be read. The SDK decides this from its own files and
never needs the main thread for it, so a call your app makes at launch returns at once in that
state too, also when the app blocks its main thread on the call.

### App extensions

Both products compile in app extension targets, such as widgets and notification service
extensions. An extension is a separate process with its own storage, and the SDK has no App Group
support: in an extension it starts its own anonymous identity, event queue and caches, and shares
none of them with the containing app. To read the signed-in user's access there, configure the
extension with `options.distinctId` set to the id your app passes to `identify`.
Set `automaticLifecycleEvents = false` in an extension so it does not report its own
`$app_installed` and `$app_opened` events. Paywalls and store sheets need an app window, so they
are unavailable in an extension, and work the app would finish under a background task runs
without one there.

## Development mode

Set `options.dev = true` to test purchases on any simulator without an App Store Connect setup.
It is honored **only in debug builds**; release builds always use the real App Store.

In development mode purchases run against a mock store: products come from the schema's
development metadata, a confirmation sheet replaces the StoreKit sheet, and the recorded purchase
is a test purchase, so it never unlocks access in production. Configure the project's test
publishable key (`vh_pk_test_…`) in debug builds: Voidhash refuses simulated purchases made with
the production key. Swiping the confirmation sheet away cancels the purchase, like its Cancel
button. Purchases need owner mode: in observer mode `purchase(_:options:)` still throws
`READ_ONLY_PURCHASE_NOT_ALLOWED`.

## Products and purchases

```swift
let products = try await voidhash.getProducts()
let monthly = try await voidhash.getProducts(slugs: ["pro-monthly"]).first ?? nil

if let product = monthly, let subscription = product.subscription {
    // Prices come formatted for the customer's storefront; never re-format them.
    print(product.price.formatted, "every", subscription.period)  // "$9.99 every 1 month"
    print(subscription.pricePerWeek.formatted)                   // "$2.31"
    if let trial = subscription.introOffer?.freeTrial {
        print("\(trial) free")                                    // "1 week free"
    }
    switch try await voidhash.purchase(product) {
    case .purchased(let transaction, let synced): …  // synced: Voidhash accepted the receipt
    case .pending: …     // Ask to Buy; completes later through transactionUpdates()
    case .cancelled: …   // the customer closed the sheet
    case .disabled: …    // the client is disabled; nothing was bought
    }
}

// Revalidates the App Store purchase history and returns the refreshed person.
let person = try await voidhash.restorePurchases()
```

`getProducts()` returns every product configured in Studio that the App Store sells, sorted by
slug; `getProducts(slugs:)` returns the ones asked for, in that order, `nil` for a slug that is not
sold. A product the App Store does not return is left out and reported once per call as the
`PRODUCT_NOT_FOUND` diagnostic (kind `store`), with its slug and why. So is a product the App Store
sells as a type that contradicts Studio's, as `PRODUCT_TYPE_MISMATCH` with both types: a Studio
subscription needs an auto-renewable subscription, a Studio consumable a consumable, and a Studio
one-time product a non-consumable or a non-renewing subscription (its `type` is then
`nonRenewingSubscription`). Each call asks the App Store again, so offers reflect the customer's
eligibility right after a purchase or an identity switch.

A `VoidhashProduct` has the Voidhash `productId` (the id person snapshots name), its `slug`, the
`store` and `storeProductId`, its `type` (`subscription`, `consumable`, `nonConsumable`,
`nonRenewingSubscription`), the Studio `name`, the store's `displayName` and `description`, and its
regular `price`. A `VoidhashPrice` holds an exact `Decimal` `amount`, `amountMicros`, the
`currencyCode` and the store's `formatted` string. `subscription` (set exactly for subscriptions)
holds the renewal `period` (a `VoidhashPeriod`: `unit`, `count`, `iso8601`; 7 days read as 1 week),
the `groupId`, the `introOffer` the customer is eligible for right now, and the regular price per
day, week, month and year, rounded to the currency's minor units (49.99 a year is 4.17 a month).

`offers` lists the promotional and win-back offers the customer can have: promotional offers only
to current and former subscribers of the group, as the App Store sells them (customers no longer
eligible for the introductory offer, or with a subscription status in the group), and only the ones
the product's App Store mapping in Studio exposes, which Voidhash signs; win-back offers (iOS 18)
only when the App Store lists them as eligible. Each `VoidhashOffer` has an `id` (a promotional
offer's Studio offer id, a win-back offer's App Store offer identifier), a `kind` and its pricing
`phases` (payment mode, price per cycle, period of a cycle, cycles). `appStore` holds everything StoreKit says about the product,
the `StoreKit.Product` itself included, for StoreKit's own views: all offers whatever the
eligibility, the subscription group's level and name, family sharing.

`purchase(_:options:)` buys through StoreKit 2, syncs the transaction with Voidhash and only then
finishes it with the store; the person is refreshed once Voidhash accepted it. Once the store has
charged the customer, the call waits for Voidhash for at most one request timeout (10 s): during an
outage it returns `.purchased(transaction:synced: false)` with the receipt queued and the
transaction unfinished, and both complete once Voidhash accepts the receipt: the retry that
delivers it finishes the transaction, a consumable's included, without waiting for the next launch.
Only one purchase runs at a time; another one throws `PURCHASE_IN_PROGRESS`. A purchase started on
the App Store while another runs is bought once that one ends.

`VoidhashPurchaseOptions` choose the price and how to buy:

- `offer`: `.automatic` (default) applies the subscription's introductory offer when the customer
  can have it; `.none` the regular price (StoreKit still applies an introductory offer the customer
  is eligible for: it has no way to decline one); `.offer(offer)` or `.id("offer-id")` one of the
  product's `offers` or its `introOffer`. `.id` takes a promotional offer's Studio offer id, which
  paywalls name it by, or its App Store offer identifier. A promotional offer is signed by Voidhash
  for the person
  (from iOS 26 as Apple's JWS, which StoreKit checks there; below iOS 26, where StoreKit cannot
  check a JWS, with the legacy signature; and with the legacy signature on any version when the
  project has no In-App Purchase issuer id) and a
  win-back offer is applied by StoreKit. An offer the customer cannot have, or that cannot be signed
  or applied, throws `OFFER_UNAVAILABLE` and never buys the product at its regular price instead;
  when the App Store refused it as the customer is not eligible, the error's `reason` is
  `.ineligibleForOffer`, as Google Play's refusal is on Android.
- `quantity`: more than 1 only for a consumable; otherwise `INVALID_ARGUMENT`.
- `appStore.simulatesAskToBuyInSandbox`, and `appStore.confirmIn`: the scene or view controller
  StoreKit shows its confirmation on (a view controller from iOS 18.2).

A `VoidhashTransaction` has the App Store transaction `id`, the `originalId` of its series, the
`productSlug` it resolves to, the `storeProductId`, `store`, `purchasedAt`, `expiresAt`,
`quantity`, `isRenewal` (iOS 17), the `offer` it was bought with and its `environment`. Its
`appStore` part holds the ownership type, the storefront country as ISO 3166-1 alpha-2, upgrade and
revocation details, the app transaction id and the signed `jwsRepresentation`.

Failures surface as `VoidhashStoreError`, whose string form is `"CODE: message"`:
`READ_ONLY_PURCHASE_NOT_ALLOWED`, `PURCHASE_IN_PROGRESS`, `OFFER_UNAVAILABLE`, `INVALID_ARGUMENT`,
`INVALID_PRODUCT_ID`, `PURCHASE_FAILED`, …. Its `reason` (`VoidhashPurchaseFailureReason`) says why
the store refused a purchase when it did; StoreKit only ever gives `ineligibleForOffer`, the
`paymentDeclined` reason being Google Play's. A dismissed sheet is the `.cancelled` result; a
dismissed App Store sign-in during a restore throws `USER_CANCELLED`.

Initialization installs the StoreKit observer and reconciles existing transactions. Renewals,
approved Ask to Buy requests and other transactions StoreKit delivers later are synced and, outside
observer mode, finished by the SDK. A transaction is finished only once Voidhash accepted it.
A transaction StoreKit cannot verify is neither synced nor finished; the SDK reports it once as the
`STOREKIT_TRANSACTION_UNVERIFIED` diagnostic, with its product and the reason.

### Updates

```swift
Task {
    for await person in voidhash.personUpdates() { … }      // starts with the cached snapshot
}
Task {
    for await update in voidhash.transactionUpdates() {
        update.transaction  // the VoidhashTransaction
        update.synced       // false while the receipt waits on the device for Voidhash
    }
}
```

`personUpdates()` yields the person snapshot each time it changes: a read, a purchase, a restore,
an identity switch. Once the client has started it starts with the snapshot cached on the device,
offline too (`nil` when nothing is cached, and after `resetPersonCache()` until the next read
answers). A read for an identity the app switched away from is never published after the switch;
neither is a flag evaluation through `featureFlags.onUpdate`.

`transactionUpdates()` yields the purchases that complete outside `purchase`: approved Ask to Buy
requests, renewals the device sees, redeemed offer codes, purchases started on the App Store.
Refunds, revocations and subscriptions the customer upgraded from are not purchases and are not
yielded; they reach the person. An update is yielded once the SDK has handled its transaction:
`synced` is `true` when Voidhash accepted the receipt, `false` while it is queued and delivered in
the background. Each transaction is yielded once a session, even when StoreKit hands it over twice;
one whose receipt Voidhash has not accepted yet stays unfinished, and the next launch yields it
again. Up to 10 that arrive while no stream is open are kept for the next stream made. It is a
signal for the interface, not a delivery guarantee. Access always comes from the person's
entitlements. Each call makes a stream of its own, which ends when the task iterating it is
cancelled.

### Store actions

```swift
try await voidhash.showManageSubscriptions(product: product)  // the product's group, iOS 17
let redeemed = try await voidhash.presentCodeRedemption()      // iOS 16
let storefront = await voidhash.getStorefront()                // countryCode "US", currencyCode
let canPay = await voidhash.canMakePayments()
```

`presentCodeRedemption()` shows the App Store's offer code sheet. From iOS 27 the sheet hands the
redeemed transaction back: it is synced, finished and returned. Before that it arrives through
`transactionUpdates()`. After the subscription management sheet closes, the person is refreshed.

### App Store features

`voidhash.appStore` reaches what only the App Store offers:

```swift
let status = try await voidhash.appStore.beginRefundRequest(transactionId: transaction.id)
let statuses = try await voidhash.appStore.subscriptionStatus(groupId: "21482951")
let entitlements = try await voidhash.appStore.currentEntitlements()
let appTransaction = try await voidhash.appStore.appTransaction()  // iOS 16
```

`subscriptionStatus(groupId:)` lists each subscription the Apple account has in the group with its
state, latest transaction and renewal information (auto-renewal, the product it renews to, grace
period, billing retry, price increase, renewal price, eligible win-back offers), the current
person's first. It is what StoreKit says on this device; the person's `subscriptions` say what
Voidhash knows across devices and stores.

Two options decide what happens to the App Store's own prompts:

- `appStoreMessages` (default `.deferWhileFlowPresented`): App Store messages, such as a price
  increase to agree to, wait while a flow is on screen, and while no window scene is in the
  foreground to show them on, until the app is active again. StoreKit hands a message over once,
  so one held when the app is killed is not shown. `.automatic` lets the App Store show them at
  once; `.manual` hands them to `appStore.messages()` for the app to show with
  `appStore.display(_:)`.
- `purchaseIntents` (default `.purchaseWhenReady`): a purchase the customer starts on the App
  Store (a promoted in-app purchase, a win-back offer) is bought through `purchase` once the client
  has initialized, so it belongs to the restored person (after a purchase still running ends), and
  arrives through `transactionUpdates()`. With `.manual` it is handed to `appStore.purchaseIntents()`, to buy with
  `purchase(intent.product, options: intent.purchaseOptions)` when the app is ready, such as after
  sign-in. An intent for a product Studio does not sell, or with an offer the customer cannot have,
  is reported and dropped. Observer mode never takes purchase intents.

Not supported: external purchase links and alternative billing, subscriptions with add-ons and
purchases of several products at once, App Store pricing terms and billing plans (iOS 26.4),
introductory offer eligibility overrides signed as JWS, and storefront change updates.

With several windows open (iPad multitasking, an external display), the purchase sheet and the
subscription management sheet appear on the app window in the foreground, unless `confirmIn` names
another. A purchase does not need a window to name: without one, StoreKit chooses where to show its
sheet.

### Observer mode

With `options.readOnly = true` the SDK observes and syncs StoreKit transactions but never finishes
one, so another billing integration can own them. `purchase(_:options:)` then throws
`READ_ONLY_PURCHASE_NOT_ALLOWED` before StoreKit is touched, and so does a purchase started from a
flow. Toggle the mode at runtime; a purchase already in flight keeps the mode it started with:

```swift
voidhash.setReadOnly(true)
let observing = voidhash.isReadOnly
```

### Report purchases from another billing SDK

In observer mode, call `reportTransaction(...)` after each successful host purchase and for each
restored transaction.
Only an Apple transaction ID or Google Play purchase token is required. Voidhash supplies the current
SDK identity and configured bundle/package; the backend fetches and verifies the store purchase.

```swift
try await voidhash.reportTransaction(transactionId: transactionId)
```

The transaction ID is a string; preserve every digit. You can also pass a `StoreKit.Transaction`
or `VerificationResult<StoreKit.Transaction>` directly to `reportTransaction(...)`. The SDK sends
only the ID. It keeps the product ID, original transaction ID, purchase date and revocation date on
the device to recognise receipts Voidhash already accepted, and discards raw JSON and signed
receipts. An older renewal of a subscription whose latest one Voidhash accepted is not sent again;
an upgrade or crossgrade, which is another product, always is. The
verified-result overload rejects unverified results. The direct transaction overload leaves local
verification with the host. Transactions from a local StoreKit configuration in Xcode are not
reported, because the App Store cannot verify them; the SDK reports this once per session as the
`STOREKIT_TESTING_TRANSACTION_SKIPPED` diagnostic. Test purchases in the sandbox instead.

Existing `VoidhashTransaction` inputs remain supported; only `transactionId` is required. Other
metadata is optional; `productId`, `originalTransactionId`, `purchaseDate` and `revocationDate`
stay on the device as above. Pass `productId` when you have it: a transaction reported without
it is recognised by its ID alone, so it is sent once even when it is an old renewal of a
subscription Voidhash already knows. Pending results are ignored. Invalid IDs throw `INVALID_TRANSACTION`. Reporting
does not require a StoreKit connection; delivery failures stay queued without throwing into the
host purchase callback.

Initialize Voidhash and identify the buyer before starting the purchase flow. Reporting never
finishes, acknowledges or consumes a transaction, and a transaction you reported stays yours to
finish from then on: the SDK does not finish it later either, in or out of observer mode, after
any outage and across relaunches, so your own code still finds it among StoreKit's unfinished
transactions. The SDK remembers the 500 transactions you reported most recently. A report
durably captures the identifier before returning and delivers it in the background. Duplicate reports preserve the original captured identity across
retries and relaunches. A receipt Voidhash already accepted is not sent again, while a refund or
Family Sharing revocation of it is. SDK diagnostics describe deferred delivery. If the identifier
cannot be written to disk (the device is out of storage, or it has not been unlocked since a
reboot), the call still returns normally, keeps the receipt in memory, retries the write and
reports a `TRANSACTION_CAPTURE_NOT_DURABLE` diagnostic.

Use `syncPurchases()` for a silent recovery scan when a host callback exposes no usable store
transaction values. It scans currently exposed purchases, skips receipts already accepted by
Voidhash (renewals and revocations are new and are sent), and refreshes person state. Store-read
failures reach the caller; delivery failures stay queued for retry. It does not prompt for store
authentication. Every receipt the scan finds is written to disk before the first is sent, and the
call waits for their delivery for at most one request timeout; after that they keep going in the
background. When delivery finishes in time, the person is refreshed before the call returns.

Connect your Restore Purchases button to `restorePurchases()`. It revalidates restorable purchases
for the identity that requested the restore, including receipts already accepted for another user.
Previously queued purchases retain their original identity and are delivered before the restore.

Only `restorePurchases()`, or a report marked as a restore, can share or move a purchase that
already gives another user access.
The project's paid access sharing setting then decides whether both keep access, access moves to
the restoring user, or it stays with the original user. Reports, recovery scans, observed renewals
and `syncPurchases()` record such a purchase for the user who has it, so signing out or switching
accounts on a shared Apple ID never takes a subscription away from its owner. Because the user
asked for it, a restore sends its receipts at once: a receipt waiting out a retry or parked after a
refusal goes immediately, and a circuit breaker opened by an outage lets a probe through.

Restore calls `AppStore.sync()` and reads verified non-consumable transaction history; this may
prompt for App Store authentication. It sends the latest transaction of each subscription or
purchase, not every renewal in its history.
Known consumables are excluded from explicit restoration. A store error or a receipt that cannot
be accepted fails the restore with `ReconcileTransactionsError`; deferred receipts remain queued.
Once the store has returned its history, the restore waits for Voidhash for at most two request
timeouts, and the first receipt that cannot reach Voidhash fails it and the receipts after it,
rather than each being sent into the same outage. Every receipt the restore found stays queued as
a restore, across relaunches, and is sent once Voidhash can be reached. An empty store can restore
successfully. A successful restore refreshes the person and returns it (`nil` when Voidhash has
none for the identity): check its entitlements to decide whether to unlock access, which also tells
the customer whether anything was restored.
Use silent sync after a host restore for discovery; call explicit restore when Voidhash must
revalidate cached receipts for the current user or give them a purchase another user has. Reports
of a host restore leave such a purchase with its owner unless you mark them as restores. When the
user asked your own billing integration to restore purchases, report each transaction it returns
with `isRestore: true`: it is sent as an explicit restore for the current user, like
`restorePurchases()`, even when Voidhash already accepted it, and stays one across retries and
relaunches.

```swift
try await voidhash.reportTransaction(transaction, isRestore: true)
```

Initialization, foreground and reconnect also perform recovery scans. Foreground/reconnect scans
are throttled to once a minute per trigger, and send only what Voidhash has not accepted yet. Scans
cannot recover a consumable already finished or consumed by the host, or arbitrary expired
subscription history. Use explicit reporting whenever transaction values are available.

## People and entitlements

```swift
let person = try await voidhash.getCurrentPerson()
let isPro = person?.hasActivePerk("pro") ?? false

try await voidhash.identify(externalUserId: "user_123", email: "ada@example.com", name: "Ada")
try await voidhash.setPersonAttributes(["plan": .string("pro"), "seats": .number(3)])

let distinctId = await voidhash.getDistinctId()
await voidhash.signOut()  // when someone is signed in: starts a fresh anonymous identity
```

`identify` and `signOut` are made to be called wherever your app's own session changes, as often as
that happens. Calling `identify` again with the same id, email and name as the last time, or again
without either, sends no request and changes nothing, also after a relaunch; a different email or
name is sent. `signOut()`
does nothing while the identity is anonymous: no `$sign_out` event, no new anonymous id, and the
groups stay. `reset()` does exactly what `signOut()` does for someone signed in, and for an anonymous
visitor starts a fresh one, with a new anonymous id and session and no `$sign_out`, for an app that wants a new
visitor.

`hasActivePerk(_:)` takes the perk slug you set in Studio. It matches each grant's `perkSlug`
(`perkId` is the perk's internal id, not its slug) and counts the grants Voidhash reports as
`active`; `activePerkSlugs` lists the perks it would match. A grant's `expiresAt` is not checked on
the device: Voidhash keeps a subscription's grant active through the App Store's billing retry and
grace period and ends it in the next snapshot, so a device clock or a renewal still waiting to be
delivered never locks out a paying customer.

`person.subscriptions.all` lists every subscription that has not ended, including ones in a grace
period, billing retry, on hold or paused, as Voidhash knows it across devices and stores: its
`status`, `periodType` (trial, intro, regular), `willRenew`, `canceledAt`, the product a pending
downgrade `renewsToProductSlug`, grace period and billing issue dates, a `pendingPrice`, the
`offerId`, family sharing and refunds. `subscriptions.current` is the one that matters most (active,
then trialing, in a grace period, in billing retry, on hold, paused). It is what a subscription
management screen shows; check access with `hasActivePerk(_:)`, never with this list. Values a
newer Voidhash sends that this version does not know decode as `.unknown(value)`.

`getCurrentPerson(forceFetch: true)` bypasses the cached snapshot when the network is usable and
waits for the backend's answer, up to the request timeout. When it cannot get one, it returns the
cached snapshot, which `getCurrentPersonState(forceFetch: true)` reports as stale.
`getCurrentPersonState()` returns the same value alongside `isStale` and `isExpired`, and a
`reason`: `fresh`, `refreshInFlight` (served from the cache while a refresh still runs),
`refreshFailed` or `noCache`. `resetPersonCache()` drops the cached snapshot so the next read asks
Voidhash.

A distinct id can contain non-Latin scripts and emoji. It must contain a non-whitespace character,
be at most 255 characters (Unicode code points) long, contain no NUL character and not start with
`vh_anon_` or `vh:anon:`, which mark the SDK's anonymous ids. Any other id is a programmer error: `identify`
throws `VoidhashStoreError` with the code `INVALID_ARGUMENT` and keeps the current identity, and a
`distinctId` option breaking these rules is ignored with a warning. To tell an anonymous id from
your own, call `Voidhash.isAnonymousDistinctId(_:)` rather than comparing a prefix.

Person traits are flat: strings, numbers, booleans or `nil`. A value that is an object or an array
is a programmer error: `setPersonAttributes` throws `VoidhashStoreError` with the code
`INVALID_ARGUMENT` before anything is sent or queued, whether or not the device is online.
Non-finite numbers are sent as `null`. A string named `email` or `name` sets the person's email or
name, as `identify` does, not a trait of that name.

`identify` switches the identity locally and queues the link from the previous anonymous id to the
account before it asks the backend, which moves the anonymous person's purchases and entitlements
to the account. `identifyState(externalUserId:email:name:)` reports whether the backend confirmed
the merge (`confirmed`) or it is still queued (`deferred`). A deferred identify returns normally:
the queue delivers it as soon as the backend is reachable, including after a relaunch, and until
then the person the anonymous id had is served for the account, marked stale, so a customer who
bought before signing in keeps their access. A cancelled `identify` still delivers the link unless
the cancel arrived before the identity switched. `identify` waits on the backend for at most 2 s.
A tagged backend error within that time, such as an id the API refuses, is thrown and the previous
identity is restored. One that arrives later keeps the identity, drops the queued link and is
reported as the `PERSON_WRITE_REJECTED` diagnostic, as is an anonymous id already linked to a
different account, which never throws. `setPersonAttributes` behaves the same way: traits are
queued before they are sent, and those the backend cannot confirm within 2 s, or that follow a
queued identify for the same person, are returned as `deferred`; a refusal arriving after that
drops them with `PERSON_WRITE_REJECTED`. Traits are sent whatever the analytics consent, except an
agreement to ad data sharing (see Ad data sharing).

A `distinctId` option pins the identity at configure time without a request. When the device used
an anonymous id before, that id is linked to the pinned one through the same queue, so purchases
made before sign-in follow the account.

`identify` and `reset` invalidate the person and flag entries of the identity you are leaving. The
anonymous user's person and flags answer for the account only until its own arrive, marked stale.
Call `identify` as early as you know who the user is; the SDK refetches per-person state for you.

## Feature flags

```swift
let flags = try await voidhash.getFeatureFlags(["new-onboarding"])
let enabled = flags.first { $0.key == "new-onboarding" }?.enabled == true
```

Each result carries the flag's `key`, whether it is `enabled`, the selected `variantKey`, and the
variant's `payload` as a `JSONValue`, or `nil` when the variant has none. Payloads are untyped
JSON, so validate one before you use it:

```swift
let pricing = try await voidhash.getFeatureFlags(["pricing-test"]).first
if case .object(let config)? = pricing?.payload, case .number(let trialDays)? = config["trialDays"] {
    showTrial(days: Int(trialDays))
}
```

Results are cached per identity for 5 minutes and served indefinitely while the backend is
unreachable, so a flag never falls back to its default during an outage. `getFeatureFlagsState()`
adds an `isStale` marker.

With nothing cached, a read waits at most `featureFlags.maxWaitMilliseconds` (2 s by default) and
then answers with the defaults; the evaluation carries on in the background. Give each flag your
app reads a safe default, and read the flags again when `featureFlags.onUpdate` reports a new
evaluation:

```swift
var options = VoidhashOptions()
options.featureFlags.defaults = ["new-onboarding": false]
options.featureFlags.onUpdate = { _, _ in
    Task { @MainActor in model.reloadFlags() }
}
```

`onUpdate` receives the key set that was evaluated (`nil` for every flag) and its results, from a
task inside the SDK: return quickly and do UI work on the main actor, as above. It is
called only for the identity signed in when the answer arrives; an evaluation for a user who
signed out meanwhile is dropped. A configured default also answers a read made while a rejected
publishable key pauses requests, instead of the `AUTHENTICATION_FAILED` error such a read throws
without a cache.

A requested key without an evaluated value, because none has arrived yet or Voidhash does not
know the flag, is answered with its `defaults` entry. When an anonymous user signs in, the flags
evaluated for the anonymous id answer for the account, marked stale, until the account's own
evaluation replaces them, also after Voidhash confirmed the sign-in; `reset()`, `signOut()`, a
switch to another user and a sign-in Voidhash refuses drop them.

## Analytics

```swift
await voidhash.capture("checkout_started", properties: ["plan": .string("pro")])
await voidhash.flush()
```

An event name is trimmed. A blank one, like a blank screen name, is ignored and reported through
`onDiagnostic` as `ANALYTICS_EVENT_INVALID`.

Events are batched (20 per request, flushed every 5 seconds while the app is in the foreground),
persisted as they are captured and retried with jittered exponential backoff until the backend
acknowledges them. `flush()` sends queued identify calls and traits, then queued store receipts,
then queued events right now, without waiting out the retry backoff, and returns a
`FlushStatus` for the events:

```swift
let status = await voidhash.flush()
print(status.flushed, status.pending, status.lastError ?? "")
```

`flush()` never throws and waits on Voidhash for at most 2 s. An unreachable or slow backend
leaves the events on disk and reports them as `pending`; delivery carries on in the background,
and `pendingTransactionCount()` reports the receipts still waiting. One flush sends at most 10
batches of events; the 5-second flush sends the rest. A server's `Retry-After` is honoured even by
`flush()`.

Every event records the app version and build, OS version, locale and time zone of the moment it
was captured, so an event sent after an app update still counts towards the release it happened
in.

Lifecycle events (`$app_installed`, `$app_updated`, `$app_opened`, `$app_backgrounded`,
`$app_became_active`, `$app_crashed`, `$sign_out`) are captured automatically. `$app_opened` marks the process's
first foreground: an app that iOS launches in the background, for a silent push or a background
fetch, reports it when the user first brings the app up, not at launch. `automaticLifecycleEvents = false`
turns off only these events: the SDK still observes the app entering and leaving the foreground to
recover, write its queues through and flush them.

`$app_crashed` comes from the crash reports iOS delivers through MetricKit at a later launch, with
`crash_kind` and the `$app_version` the report names. The SDK reads nothing else from a report and
installs no signal or exception handler. It subscribes once the client has started and the app is in
the foreground, and only on iOS.

Report a notification the end user opened from your own notification handling, since the SDK does
not take over your notification delegate. It records `$push_opened` with its
`push_notification_send_id`, and ignores a notification Voidhash did not send:

```swift
voidhash.trackPushOpened(userInfo: response.notification.request.content.userInfo)
```

Automatic screen tracking records a `$screen` event when a view controller of your app appears. By
default a controller belongs to your app when its class is defined in the app's main bundle. That
rule misses controllers defined in an embedded dynamic framework, such as a feature module, and
counts controllers of a statically linked library as your own. Set
`options.screenTracking.isAppScreenClass` to decide yourself; `mapScreen` renames or drops a screen
afterwards. A SwiftUI view marked with `.voidhashScreen(_:)` replaces its hosting controller,
including an app-defined `UIHostingController` subclass, as the screen.

### Groups

Put the end user in a group, such as the company or workspace they use your app as part of, and
every later event carries it in `$groups`:

```swift
await voidhash.setGroups([
    "company": VoidhashGroup(id: "acme", properties: ["name": .string("Acme")]),
    "team": "design",
])
print(await voidhash.groups) // ["company": "acme", "team": "design"]
await voidhash.resetGroups()
```

`setGroups` replaces every group the end user belongs to, so call it with all of them wherever your
app learns them, as often as that happens. A type you leave out is left, without an event, and an
empty dictionary behaves like `resetGroups()`. It sends a `$groupidentify` for a type only when its
id changed or its properties differ from the ones it last sent, so a repeated call sends and stores
nothing. A `$groupidentify` that could not be recorded for lack of analytics consent is sent by the
next call that can.

`group(type:key:properties:)` sets the group of one type and leaves the others:

```swift
await voidhash.group(type: "company", key: "acme", properties: ["name": .string("Acme")])
```

A group type is a lower-case letter followed by up to 63 lower-case letters, digits or
underscores; a key, or a `VoidhashGroup`'s `id`, has 1 to 256 characters. Anything else is
ignored with a warning. The end user
belongs to one group of each type. `group` sends a `$groupidentify` with the group's properties
(strings, numbers or booleans) when you pass some or when the group of that type changed. Groups are
stored with the distinct id, kept by `identify` and cleared by `signOut()` and `reset()`, and are
described to Voidhash whatever the analytics consent (see Consent); an event
keeps the groups it was captured under while it waits in the queue, and a group the event names in
its own `$groups` wins for its type.

### Consent

When the user declines usage analytics, or has not decided yet, tell the SDK:

```swift
await voidhash.setAnalyticsConsent(.denied)   // or .pending, or .granted
print(voidhash.analyticsConsent)
```

Consent covers what the SDK observes about the person, not what your app says about them. While
consent is `denied` or `pending`, the SDK collects no analytics: custom events, screens, lifecycle
events and paywall and flow events are dropped without being queued, written to disk or sent, no
analytics session is kept, and installs are not attributed. Withdrawing consent also discards what
was collected and not sent yet, including a batch already on its way. Granting it collects from
then on; nothing dropped meanwhile is sent later. A launch without consent leaves
`$app_installed` and `$app_updated` to the first launch, or the moment, consent is granted; at
that moment they are recorded before any held event, at the time of the earliest one.

Purchases, restores, entitlements, `identify` (which still sends the email and name you pass),
person attributes, groups, feature flags and paywalls work the same whatever the consent, so flags
and cohorts that target on attributes or groups behave the same for someone who declined. Person
attributes are queued and sent as with consent, and withdrawing it keeps the ones still queued.
Without consent a group's `$groupidentify` is not queued: it goes out at once in a request of its
own, carrying only the group, its properties and the distinct id, with no session and no device
properties. It is not stored or retried, and `setGroups` sends it again on its next call if the
request failed. Requests to Voidhash carry the
consent, so the backend records no paywall exposure for them either; revenue reporting is
unaffected, while impression-based metrics, such as paywall conversion, count only users who
granted consent.

`options.analyticsConsent` sets the consent at launch and defaults to `.granted`. A decision passed
to `setAnalyticsConsent` is stored on the device and takes precedence over the option on later
launches; `reset()` and `signOut()` keep it. Skipped analytics are reported once per period without
consent through `onDiagnostic`, as `ANALYTICS_CONSENT_DENIED` with the `consent` kind.

With `options.analyticsWhilePending = .buffer`, events that happen while consent is `pending` are
not dropped but held in memory with the time they happened: custom events, screens, lifecycle
events and paywall and flow events. Nothing is written to disk or sent. When
consent becomes `granted` they are recorded in order, each at its own time, under the identity,
groups and session in effect at that moment; when it becomes `denied` they are discarded. At most
100 events are held, the oldest dropped first and reported as `ANALYTICS_EVENT_DROPPED`, and they
do not survive the process; a client configured again takes them over. `$sign_out` is not held,
person traits and group descriptions are sent without waiting for the decision, and `denied` holds
nothing.

With `options.grantConsentOnIdentify = true`, signing in counts as the consent, for apps whose
terms of sign-in cover analytics. `identify` while consent is `pending` grants it first, so held
events are recorded under the anonymous id the identify then links to the person. `denied` is
never overridden. Such a grant lasts as long as the sign-in: `signOut()` and `reset()` record
`$sign_out`, send the queued events (waiting at most 2 s, as `flush()` does) and return consent to
`pending`, which drops whatever was not sent. The grant is stored as
implied, so this also holds after a relaunch. Any `setAnalyticsConsent` call replaces it with the
end user's own decision, which sign-out keeps.

### Ad data sharing

`setAdDataSharing(true)` records that the end user agreed to you sharing their purchases with ad platforms, as the
person trait `$ad_data_sharing`. Unlike other person attributes it needs analytics consent: without it the
agreement is left out of the write, and the other attributes in the same call are still sent. Withdrawing
consent also takes an agreement that is still queued out of the queue, and granting it again does not bring it back.
`setAdDataSharing(false)` takes it back: analytics consent neither blocks nor discards that. It is stored on the
device and retried until Voidhash has written it, or for 48 hours while Voidhash has no such person, and
it records no analytics. Setting the trait to `false` as a person attribute does the same. Agreeing
again drops a revocation still queued; when that revocation is on its way to Voidhash at that moment,
`setAdDataSharing(true)` returns `deferred` and the agreement is sent right after it. Declining
analytics does not take it back by itself, so when someone rejects everything, call both `setAdDataSharing(false)` and `setAnalyticsConsent(.denied)`.

### Install attribution

On a new install the SDK asks Apple, through AdServices, whether an Apple Ads campaign brought the
end user, and records the answer on the person as a touch (`$initial_*` and `$latest_*` traits), which
a later `identify` carries over from an anonymous person. It sends no advertising identifier and
needs no App Tracking Transparency prompt.

It runs once per install, off the launch path, and only while analytics consent is granted: a grant
later runs it then, and a withdrawal cancels it. The answer is recorded only once it is definitive.
A `404` is asked again twice, five seconds apart. Then, as for a `5xx`, a network failure or a token
Apple cannot provide yet, a later launch asks again, up to 10 launches, reported through `onDiagnostic`
as `INSTALL_ATTRIBUTION_DEFERRED`. `INSTALL_ATTRIBUTION_ABANDONED` reports that it stopped asking. An
install that already held an identity when this SDK version first ran is not read, nor is an app
extension. Set `options.installAttribution = false` to turn it off.

The App Store has no referrer, so a link from your website cannot carry a campaign to it: connecting
a web visit to the app takes a sign-in on both. Meta and TikTok app-install ads have no path to an
individual install on iOS without App Tracking Transparency, so their app-install numbers stay the
ones the platform reports.

## Paywalls and flows

Paywalls and multi-screen flows (onboarding, surveys) are drawn natively by the `VoidhashUI`
package, which renders them with Metal. A paywall is a flow with one screen. `VoidhashUI` isn't in
the published package yet: build it from source as
[Add the paywall renderer](https://voidhash.com/docs/sdks/swift/paywalls#add-the-paywall-renderer)
describes, then pass the renderer when configuring and grant what flows may do:

```swift
import Voidhash
import VoidhashUI

var options = VoidhashOptions()
options.paywallRenderer = VoidhashUIPaywallRenderer()
options.flowCapabilities = [.links, .notifications, .attributes]
let voidhash = Voidhash.configure(publishableKey: "vh_pk_…", options: options)

switch await voidhash.presentFlow(placement: "onboarding") {
case .finished(let result, let variables): …  // the flow reached a finish action
case .purchased(let productSlug): …           // a purchase from the flow completed
case .restored: …
case .closed: …                               // closed by the user or dismissFlow()
case .failed(let error): …                    // FlowError, see below
}
```

`presentFlow` returns once the flow has ended and left the screen, so you can present your next
screen as soon as it returns. It downloads the published package, verifies it against the hash the
backend reported and keeps it on the device, so a placement shown once shows again offline, and a
package that cannot be downloaded falls back to the one the placement showed last. A package
larger than 16 MB is not loaded. A flow shows images from `http` and `https` URLs only, and skips
an image larger than 10 MB.

The images a flow shows are kept on the device too, up to 64 MB of them, the ones shown longest
ago making room for new ones. Loading a flow's package, for a presentation or a preload, fetches
the images the package lists in the background, and an image downloaded while a flow is on screen
is kept as well. A flow shown again, or preloaded, therefore has its backgrounds, product art and
icons when the host serving them is down or the device is offline. An image that cannot be
fetched never keeps a flow from showing; it is fetched again the next time it is needed. The
images belong to the project, not to a person: `reset()` and `signOut()` leave them in place.
A kept image is not downloaded again, so upload changed artwork as a new asset rather than
replacing the content behind a URL.

Only PNG, JPEG, WebP and GIF images are kept. A page served where an image was asked for, by a
proxy or a failing host, is not, and an image that turns out not to decode is dropped again, so
neither keeps a flow from getting the real image later. Fetching ahead is sparing: once per
package while the app runs, at most half of the 64 MB at a time, never at the expense of an
image another flow of the same run needs, and not at all on cellular, on a personal hotspot or
in Low Data Mode. A flow on screen always downloads the images it is missing, on any connection.

A flow has 15 seconds from the `presentFlow` call to be ready to show: resolving the placement,
downloading the package and waiting for a flow already on screen to leave. When that takes
longer, nothing is shown, then or later, and `presentFlow` returns `.failed(.unavailable)`, so a
paywall never appears over whatever the user has moved on to. The download carries on, and the
next presentation of the placement finds the package on the device. Preload the placements you
show early with `options.preloadPlacements`. Once the flow is on its way to the screen, no time
limit applies.

The flow is presented full screen from the top view controller of the key window, also while the
app is not active yet: at launch, or under a system alert. Pass a view controller to
`presentFlow(placement:from:)` to present from that one instead; it has to be on screen and not
presenting anything itself. Presenting a flow while another is on screen closes that one first.

`dismissFlow()` closes the flow and returns once it is off the screen. Called while the flow is
still loading, it keeps the flow from being shown. Cancelling the task that awaits `presentFlow`
does the same. In both cases `presentFlow` returns `.closed`, as it does when your app dismisses
the flow's view controller itself, for example by dismissing everything its root view controller
presents.

Shutting the client down, which configuring the SDK again does to the client it replaces, ends
its flows too: a flow on screen is closed and its `presentFlow` returns `.closed`, and one that
is still loading is not shown and fails with `.disabled`. `dismissFlow()` on that client still
waits for the flow to leave the screen.

`FlowError` says why nothing was shown: `.notAssigned` when nothing is published for the
placement, `.unavailable` when it was never downloaded and the backend cannot be reached, or it
was not ready within 15 seconds,
`.rendererMissing` without `options.paywallRenderer`, `.unsupportedPackage` when the flow needs
a newer SDK, `.presentationFailed` when there is nothing to present from or the flow can no longer
be drawn, and `.disabled` for a disabled or shut-down client. Without a renderer no placement is
resolved or preloaded and no paywall request is made.

**Capabilities.** Purchases, restores, closing and analytics need no grant. Everything else a
flow can do is off until you grant it in `options.flowCapabilities` (default `[.links]`); an
action you did not grant is skipped and reported through `onWarning`:

- `.links` opens links outside the app.
- `.notifications` asks for notification permission (`UNUserNotificationCenter`).
- `.tracking` asks for App Tracking Transparency permission. Your Info.plist needs
  `NSUserTrackingUsageDescription`; without it the request is refused.
- `.attributes` sets person attributes, like `setPersonAttributes`.

Events a flow tracks are captured with `paywall_location` and `paywall_id` properties, and each
screen it shows is recorded as a `$screen`.

A purchase started from a flow is reported with the paywall it was made on, so its revenue, and
the revenue of its renewals, is credited to the placement, paywall, release and experiment variant
in Voidhash analytics. Purchases made outside a flow and restores are not credited to a paywall,
and neither is an Ask to Buy purchase approved after the flow closed. A `FlowHost` of your own
receives that paywall in `purchaseFromPaywall`, to send with the receipt as `paywallContext`;
without it, the flow buys through `purchase` and `purchaseOffer` and names no paywall.

**Saved progress.** A flow's variables are saved on the device as the user moves through it, per
person and flow, and restored the next time the flow is presented, so a user who leaves an
onboarding flow halfway resumes where they left. Finishing the flow clears the saved state, and so
does a purchase in a paywall; an onboarding flow keeps going after a purchase. Switching to another
person clears it too.

A purchase started from a flow runs through `purchase(_:options:)`, with the offer the flow names or
the automatic price, so it is synced and finished the
same way. Flows name products by slug; a package built before that names them by App Store product
id, which still resolves. In observer mode it is refused and the flow shows it as failed
(`READ_ONLY_PURCHASE_NOT_ALLOWED` is reported through `onWarning`). A cancelled purchase leaves
the flow on screen.

## App Store privacy details

`VoidhashCore` ships a privacy manifest (`PrivacyInfo.xcprivacy`), which Xcode includes in your
app's privacy report. It declares no tracking, and gives the reasons for the required-reason APIs
the SDK calls: `UserDefaults` (CA92.1), for the SDK's own state, and the system boot time
(35F9.1), to measure elapsed time for retries and timeouts. It lists the data the SDK sends to
Voidhash, all linked to the user and none used for tracking:

- User ID and device ID: the distinct id, anonymous or your own, for app functionality and
  analytics.
- Email address and name, when you pass them to `identify`, for app functionality.
- Purchase history: the store transactions the SDK reports, for app functionality and analytics.
- Product interaction: captured events, screens and lifecycle events, for analytics.
- Advertising data: the Apple Ads campaign, ad group and ad behind the install, for analytics. See
  [Install attribution](#install-attribution).
- Crash data: that the app crashed and in which version, for analytics. No crash logs are sent.
- Coarse location: Voidhash derives an approximate, city-level location from the address of
  analytics requests, for analytics. No device location API is used.

Declare anything else you send through the SDK, such as person attributes or event properties
that hold personal data, in your app's own privacy details.

## Migrating to the billing API

The billing API is a clean break; each change is a compile error to fix:

- `VoidhashProduct`: `id` is now the slug (`Identifiable`); use `storeProductId` for the App Store
  product id and `productId` for the Voidhash one. `displayPrice`, `price` and `currency` are
  `price.formatted`, `price.amount` (a `Decimal`) and `price.currencyCode`; `interval` is
  `subscription?.period`; the StoreKit type string is `appStore?.productType`; `productType` is
  `type`; `providerProductId` is gone.
- `purchase(product:offerId:)` is `purchase(_:options:)`, with `options.offer = .id("offer-id")`
  for an offer, where a promotional offer's id is its Studio offer id (its App Store offer
  identifier also resolves), and returns a `VoidhashPurchaseResult`: a cancelled sheet and a pending purchase
  are results, no longer `USER_CANCELLED` and `PURCHASE_PENDING` errors; `.completed` and
  `.deferred` are `.purchased(transaction:synced:)`. `purchase(productSlug:)` is gone: load the
  product with `getProducts(slugs:)`.
- `restorePurchases()` returns the person.
- `presentCodeRedemptionSheet()` is `presentCodeRedemption()`; `showManageSubscriptions()` takes
  an optional product.
- `VoidhashTransaction` is the transaction as the App Store reports it (`id`, `originalId`,
  `productSlug`, `storeProductId`, dates as `Date`, `appStore` part); `PurchaseOutcome` and
  `VoidhashPurchaseState` are gone.
- `FlowResult.purchased` names the product's slug, and a flow's product `id` is its slug.
- `subscriptions.current` is an `SdkSubscription`, whose `status` is an enum.
- A cached schema whose products have no `id` is fetched again.
- `VoidhashDiagnosticKind` has a new case, `store` (`PRODUCT_NOT_FOUND`, `PRODUCT_TYPE_MISMATCH`,
  `OFFER_UNAVAILABLE`): an exhaustive `switch` over it needs the case.
- A product whose App Store type contradicts its Studio type is left out of `getProducts`, where it
  was sold as the App Store's type; `VoidhashProduct(definition:storeProduct:)` is failable.
- `product.offers` lists only the promotional offers Studio exposes, under their Studio offer ids.

## Migrating from 0.0.1-alpha.1

The offline-first release changes observable behaviour in five places. None of them need a code
change unless you were relying on the old failure modes.

1. `waitForInitialization()` and `start()` no longer fail because the schema fetch failed. If you
   wrapped them in a `do/catch` to show an error screen on a cold, offline launch, remove it: the
   SDK now boots on cached or empty state and refreshes in the background. The call still
   `throws`, so existing `try` sites compile unchanged.
2. A failed store connection no longer fails initialization either. It is reported through
   `onWarning`/`onDiagnostic` and costs transaction observation for that launch, not the SDK.
3. `flush()` now returns a `FlushStatus` instead of `Void`. Existing `await voidhash.flush()`
   call sites compile unchanged because the result is discardable.
4. `presentPaywall(location:delegate:)` is replaced by `presentFlow(placement:)`, which returns a
   `FlowResult` when the flow ends; see [Paywalls and flows](#paywalls-and-flows).
5. Cached entries are served past their TTL rather than discarded. If you treated a `nil` person
   as "signed out", read `getCurrentPersonState().isExpired` instead.
6. Images a flow shows are now kept on the device (up to 64 MB) and read from there before the
   network. Nothing is required of you; a URL whose content you replace keeps showing the kept
   image, so publish changed artwork under a new URL.
7. `presentFlow` gives a flow 15 seconds to be ready to show and then returns
   `.failed(.unavailable)` without showing it, where it used to wait for as long as the placement
   took to resolve and the package to download (over a minute on a bad connection). Treat that
   result like any other failure to present, and preload placements you show at launch.

The persisted cache moved to a namespace derived from your publishable key and API origin, and
the schema entry moved from a per-app-version key to a single one. Both are migrated once, on the
first launch of the new version: the distinct id, the analytics session, the last seen app
release, the processed-transaction records and the cached schema are carried across, so an
upgrading device keeps its identity and does not re-report `$app_installed`. Nothing is required
of you. Changing the key or the API origin later starts fresh state, as described under
[Configure](#configure).

## Test

```sh
swift test --package-path Tests
```

The whole package — including the StoreKit engine, the flow coordinator and the SDK client — is
testable on macOS; UIKit-only code paths are compiled out there.
