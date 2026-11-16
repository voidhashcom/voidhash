# Voidhash React Native SDK

React Native SDK for in-app purchases, paywalls, entitlements, feature flags, and product
analytics.

Full documentation: <https://voidhash.com/docs/sdks/react-native>. This file covers the details most
often needed while integrating.

## Install

```sh
npm install @voidhash/react-native react-native-nitro-modules@0.37 effect@4.0.7
```

The SDK peers on an exact `effect` release and on one Nitro minor, so install those versions
explicitly; a plain `npm install effect` resolves an incompatible major. The package ships native
code, so it requires a development build. In Expo Go the package still imports and the app runs, but
`init()` fails with `FAILED_TO_INITIALIZE_VOIDHASH_CLIENT`.

The iOS layer links the shared `VoidhashCore` pod from `@voidhash/ios`, which is installed
automatically as a dependency but is not on the CocoaPods trunk, so the app's Podfile has to point
at it. Android needs no extra setup.

**Expo:** register the config plugin, which adds the pod during prebuild, then rebuild the app.

```json
{
  "expo": {
    "plugins": ["@voidhash/react-native"]
  }
}
```

```sh
npx expo prebuild
```

**Bare React Native:** add the two pods inside your app target, above `use_native_modules!`, then
run `npx pod-install`. The path is resolved through Node, so it works with hoisted and isolated
`node_modules` layouts alike.

```ruby
pod "VoidhashCore", :path => File.dirname(`node --print "require.resolve('@voidhash/ios/package.json', { paths: [require.resolve('@voidhash/react-native/package.json')] })"`.strip)
pod "Voidhash", :path => File.dirname(`node --print "require.resolve('@voidhash/ios/package.json', { paths: [require.resolve('@voidhash/react-native/package.json')] })"`.strip)
```

## Compatibility

| Dependency                   | Requirement                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| `react-native-nitro-modules` | Peer `^0.37.1` — 0.37.x                                      |
| `effect`                     | Peer `4.0.7`                                                 |
| Expo SDK                     | Verified on 55; developed against 54. Optional for bare apps |
| React Native                 | Verified on 0.83; developed against 0.81                     |
| Google Play Billing Library  | 9, shared with the app's own billing library                 |
| `react-native-iap`, if used  | 16.6.2 or later                                              |
| Platforms                    | iOS and Android                                              |

Every Nitro-based module in the app resolves against one shared native runtime. Mixing Nitro
versions across modules produces native build or load failures that do not point back at Voidhash.
Earlier `react-native-iap` releases require an older Nitro minor.

On Android the SDK adds Google Play Billing Library 9, and Gradle resolves one version for the whole
app. Billing 9 removes no Billing 8 APIs, but a billing library in the app that still calls APIs
removed in Billing 8 fails at runtime, so upgrade it before adding the SDK. Billing 9 also requires
the app to compile against Android SDK 35 or later.

### Native client and upgrading

The SDK runs on the native Voidhash clients, the same ones the iOS and Android SDKs ship: identity,
purchases, analytics, feature flags and paywalls are handled natively, and the JavaScript layer keeps
the API, the hooks and the navigation integrations. This release therefore needs a new native build:
an over-the-air JavaScript update cannot deliver it, and once an app runs it, an over-the-air update
must not roll back to an earlier SDK version, which would not find the state the native client now
keeps. On the first launch after the upgrade, the identity, the analytics consent, queued events,
identity links and store receipts, and the cached person, flags and paywalls carry over, so no end
user loses access, data or a pending purchase. A JavaScript bundle that runs on a binary without the
native client, or without Nitro, still loads: `init()` fails with
`FAILED_TO_INITIALIZE_VOIDHASH_CLIENT` and asks for a rebuild. So does one that runs on a binary
built with a version of the SDK whose native client speaks another version of the contract between
the two, which it would misread.

`unstable_nativeEngine` no longer has an effect. It is still accepted, and development builds log a
one-time notice when it is set.

## Create the client

`createVoidhashClient` takes the publishable key and an options object. There is no schema
argument: the schema lives on the server and is fetched when the provider mounts. Slug types come
from `voidhash.gen.d.ts`, written by `npx voidhash-cli types generate`.

Create the client once, at module scope. A client for the same publishable key and base URL shares
its identity, queues and receipt outbox with any other, so a second one ends the first when it
initializes (development builds warn about it). Purchase reports, `syncPurchases()`,
`restorePurchases()`, `identify(...)`, `identifySync(...)`, `reset()` and `signOut()` made on the
replaced instance are handed to the live one.

Clients for different publishable keys or base URLs (two projects, or an environment switched at
runtime) run side by side on iOS. Android runs one Voidhash client per process, so there a client
that initializes ends the one that was running, whichever project it belongs to (development builds
warn about it). The ended client reports `isInitialized` as `false` and answers reads with
`VOIDHASH_CLIENT_NOT_INITIALIZED`; nothing made on it is handed to the other project's client. An
identity call or a purchase report on it starts it again, which ends the other one in turn, so on
Android use one client at a time and `end()` it before switching.

Release builds use the production `vh_pk_...` key, including builds you test through TestFlight or
Play testing tracks: their purchases are store sandbox purchases, which unlock access by default.
Debug builds in development mode (`dev: true`) use the test `vh_pk_test_...` key, as do internal
builds that run against staging. See
[API keys](https://voidhash.com/docs/concepts/api-keys).

```ts
import { createVoidhashClient } from "@voidhash/react-native";

export const voidhash = createVoidhashClient("vh_pk_...", {
  debug: __DEV__,
});
```

| Option                     | Default                    | Notes                                                                           |
| -------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `scheme`                   | none                       | Deprecated. Accepted for compatibility; no longer needed.                       |
| `distinctId`               | Persisted anonymous id     | Seeds the first `init()` only; usually omit and `identify()`. Blank is ignored. |
| `debug`                    | `false`                    | Verbose HTTP logging.                                                           |
| `dev`                      | `false`                    | Fake-store purchases in debug builds; ignored in release builds.                |
| `enabled`                  | `true`                     | `false` ships the SDK fully inert. Fixed at construction.                       |
| `readOnly`                 | `false`                    | Observer mode; see below. Mutable via `client.setReadOnly()`.                   |
| `baseUrl`                  | `https://api.voidhash.com` | API origin; an absolute `http(s)` URL. Blank is ignored.                        |
| `ingestUrl`                | Same origin as `baseUrl`   | Analytics origin override; an absolute `http(s)` URL. Blank is ignored.         |
| `analyticsConsent`         | `"granted"`                | `"denied"` or `"pending"` turns analytics off; see "Analytics consent".         |
| `analyticsWhilePending`    | `"drop"`                   | `"buffer"` holds events while consent is pending; see "Analytics consent".      |
| `grantConsentOnIdentify`   | `false`                    | `identify()` grants a pending consent; see "Analytics consent".                 |
| `automaticLifecycleEvents` | `true`                     | Automatic `$app_*` lifecycle and `$sign_out` events.                            |
| `installAttribution`       | `true`                     | Credits new installs to the ad behind them; see "Install attribution".          |
| `metaAppId`                | none                       | Android: also asks Meta's apps about the install; see "Install attribution".    |
| `screenTracking`           | `{ enabled: true }`        | Automatic `$screen` events; see "Screen tracking".                              |
| `flowCapabilities`         | `["links"]`                | What paywalls and flows may do; see "Paywalls".                                 |
| `featureFlags`             | `{ maxWaitMs: 2000 }`      | How long a first flag read waits, and flag defaults; see "Feature flags".       |
| `preloadPlacements`        | `[]`                       | Placements whose flows download at launch; see "Paywalls".                      |
| `onDiagnostic`             | none                       | Reports failures the SDK recovered from; see below.                             |
| `connectivity`             | none                       | No longer needed: reachability is observed natively. Accepted and ignored.      |
| `unstable_swallowErrors`   | `false`                    | Deprecated; see below.                                                          |

## Provider and initialization

Mount the provider at the app root. It initializes identity, schema, person state, the store
adapter, and the transaction observer. Apps with several React roots (react-native-navigation
screens, brownfield views) mount one provider per root: every provider of a client shares one
lifecycle, so the client initializes with the first provider and ends only when the last one
unmounts.

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

`status` is `"failed"` whenever `init()` answers an error, for example when an over-the-air update
ships this SDK's JavaScript to a binary built without its native modules, or with native modules of
an incompatible SDK version. `initError` is `null`
unless `status` is `"failed"`. `retryInit()` re-runs `init()` on a fresh runtime and no-ops while
initializing, ready, or disabled.

Hooks report `isLoading: true` while the provider is initializing and until their own first read
has answered, so `if (isLoading) return null; return hasAccess ? <Premium /> : <Upgrade />` never
shows a paying user the upgrade screen on launch. A disabled or failed provider reports
`isLoading: false`. Hook results are plain values for non-Effect code: `error` and `grant` are
`null` when there is none, `useFeatureFlags().getVariant(key)` returns
`{ enabled, variantKey, payload }` or `null`, `useFeatureFlags().getVariantValue(key)` returns a
string or `null`, and a product the store does not sell is `undefined`.

Hooks read the provider created with them. Outside it a development build throws
(`useProducts must be used within a VoidhashProvider`), so a missing provider shows at once; a
release build leaves the hook inert.

### Disabled clients

`enabled: false` returns a fully inert client: no native store connection, no network, no
listeners. `init()` and every side-effect method no-op, and reads answer with their empty shape.
The client is inert in the same way without a publishable key (`null`, `undefined` or blank), so a
build or an environment that has no key creates and calls the SDK like any other, and on a platform
other than iOS and Android.

```ts
export const voidhash = createVoidhashClient("vh_pk_...", {
  enabled: false,
});
```

Mount the provider unconditionally either way. Every hook still mounts on a disabled client, so
hook order never changes between a flagged-off and a flagged-on build. `enabled` is fixed at
construction; enabling later means creating a new client, which is cheap because a disabled one
never built its runtime.

## Products

`useProducts()` answers every product the store sells this end user, sorted by slug. Pass slugs
to get those products, in that order, as a tuple:

```tsx
const {
  products: [yearly, monthly],
  isLoading,
  error,
  refetch,
} = voidhash.useProducts(["yearly", "monthly"]);
```

A product the store does not return is `undefined`, and `onDiagnostic` hears about it once per load
as `PRODUCT_NOT_FOUND`, with the slug and the store's reason. `useProducts()` without slugs also
answers `data.get(slug)` and `data.bySlug`, both `undefined` for such a product. Every mounted
`useProducts()` shares one load, which runs again after an identity change, a completed purchase or
restore (in a flow too), a transaction update other than a renewal, or new product definitions,
since offers and their eligibility are the end user's; changes that land together load once. It
also loads again when the client starts after `end()`. `client.getProducts()` and
`client.getProducts(slugs)` answer the same products.

A `Product` is a union on `type`: `subscription`, `consumable`, `nonConsumable`,
`nonRenewingSubscription` (App Store only) or `unknown`. Every product has `productId` (its
Voidhash id), `slug`, `store`, `storeProductId`, `name` (from Studio), `displayName` and
`description` (from the store), `price` and `offers`. A price is
`{ amount, amountMicros, currencyCode, formatted }`: show `formatted`, the store's own localized
string, and compare `amountMicros`, which is exact. A subscription also has `subscription`:

```tsx
if (yearly?.type === "subscription") {
  const { period, introOffer, pricePerMonth } = yearly.subscription;
  // period: { unit: "year", count: 1, iso8601: "P1Y" }
  // introOffer: the free trial or intro price this end user can get now, if any
  // pricePerMonth: the regular price per month, rounded and formatted by the native SDK
}
```

An offer is `{ id, kind, phases, price? }`: `kind` is `introductory`, `promotional`, `winBack` or
`oneTime`, `phases` the pricing phases before the regular price (`{ paymentMode, price, period,
cycles }`), and `price` what a `oneTime` offer costs. On Google Play, `introOffer` is the base
plan's offer tagged `voidhash-intro`, or else its longest free trial; Google Play lists
developer-determined offers to every user, so tag one meant for some users only `voidhash-ignore`
or buy it by name.

With the types `voidhash-cli types generate` writes, each product is typed by its slug's Studio
type: a subscription's slug is a `SubscriptionProduct`, a one-time consumable's a
`ConsumableProduct`, and a one-time product's a `NonConsumableProduct` or, where the App Store sells
it as one, a `NonRenewingSubscriptionProduct`. A product the store sells as another type is left
out and reported through `onDiagnostic`, so it is `undefined` like a product the store did not
return. `yearly?.subscription` then needs no check of the type, only that `yearly` loaded. Every
enum the SDK reads has an `unknown` case, so a newer store or server never breaks decoding.

`product.appStore` and `product.googlePlay` hold the store's own view of the product with its own
field names: StoreKit's subscription group, introductory, promotional and win-back offers and
eligibility, or Play Billing's base plans, offer tokens, tags, pricing phases and one-time offers.

## Purchases

By default the SDK owns store transactions. `usePurchase()` (or `client.purchase(product)`) opens
the native store sheet, sends the transaction to Voidhash, and once Voidhash records it finishes it
with the App Store or acknowledges it with Google Play (consumables are consumed so they can be
bought again). Person state and products refresh after the purchase.

```tsx
const {
  products: [monthly],
} = voidhash.useProducts(["monthly"]);
const { purchase, pendingProduct, error } = voidhash.usePurchase({
  onSuccess: ({ transaction, synced }) => showThanks(),
});

if (monthly) {
  const result = await purchase(monthly);
  // Ok: { status: "purchased", transaction, synced } | { status: "pending" }
  //   | { status: "cancelled" } | { status: "disabled" }
}
```

`purchase()` never rejects and waits for `init()`. `purchased` means the store charged; `synced` is
`true` once Voidhash accepted the receipt and `false` while it waits on the device, to be sent at
launch, in the foreground and when the device is back online. Either way the purchase is done:
`onSuccess` runs for both. `pending` means the store needs outside action first, such as Ask to
Buy or a pending payment; it completes later as a transaction update. `cancelled` and `pending`
are outcomes, not errors. Grant access from the person's entitlements, not from the store dialog.

Failures arrive as an `Err`: `FAILED_TO_PURCHASE` (with `error.reason` when the store said why:
`ineligibleForOffer` on both stores, `paymentDeclined` on Google Play only), `OFFER_UNAVAILABLE`,
`PURCHASE_IN_PROGRESS`,
`READ_ONLY_PURCHASE_NOT_ALLOWED`, `INVALID_ARGUMENT`, or one of the codes under "Changing a
subscription" below. One purchase runs at a time: another one, of any product and from any
caller, fails with `PURCHASE_IN_PROGRESS` and buys nothing. `usePurchase()` answers a second press
for the product it is buying, with the same options, with the purchase already running; the same
product with other options (another offer, say) fails with `PURCHASE_IN_PROGRESS` too.
`pendingProduct` names the product being bought.

Both `client.purchase(product, options)` and the hook's `purchase(product, options)` take:

| Option       | What it does                                                                                                                                                                                                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offer`      | `"automatic"` (default): a subscription's `introOffer` when there is one, else the regular price. `"none"`: the regular price (the App Store may still apply an intro offer the user is eligible for). An `Offer`, or an offer's `id`. An offer that cannot be bought fails with `OFFER_UNAVAILABLE`, never falling back to the regular price. |
| `quantity`   | Default 1. Several only of an App Store consumable; on Google Play the user picks the quantity in the store's sheet. Anything else is `INVALID_ARGUMENT`. The transaction reports what the store charged for.                                                                                                                                  |
| `replacing`  | The subscription this purchase replaces on Google Play; see below.                                                                                                                                                                                                                                                                             |
| `appStore`   | `{ simulatesAskToBuyInSandbox }`.                                                                                                                                                                                                                                                                                                              |
| `googlePlay` | `{ isOfferPersonalized, obfuscatedProfileId, offerToken }`. `offerToken` buys exactly that Google Play offer, from `product.googlePlay`, whatever `offer` says.                                                                                                                                                                                |

On Google Play, eligibility for an introductory offer belongs to the Google account, not to the
Voidhash identity. A purchase of an offer the account cannot get fails with `ineligibleForOffer`,
as does a promotional or win-back offer the App Store refuses the user; the products reload without
it, and nothing is retried at the regular price. They reload after `OFFER_UNAVAILABLE` too.

### Changing a subscription

On Google Play, buying another subscription product does not end the one the user already has:
they hold both, and Google Play bills both. To move a subscriber to another product (an upgrade, a
downgrade or another plan), name the subscription the purchase replaces:

```tsx
const monthly = products.get("monthly");
const yearly = products.get("yearly");
if (monthly && yearly) {
  const result = await purchase(yearly, {
    replacing: { product: monthly, mode: "withTimeProration" },
  });
}
```

The SDK asks Google Play for the user's current purchase of the replaced product, so you handle no
purchase tokens, and Google Play ends that subscription when the new one starts. The new purchase
is sent to Voidhash and acknowledged like any other; once Voidhash has it, the replaced
subscription no longer grants access.

| `mode`                | What Google Play charges                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `withTimeProration`   | Nothing now. The time left on the old subscription is converted into time on the new one, which moves the next billing date. The default, as on Google Play. |
| `chargeProratedPrice` | The price difference for the rest of the period, now; the billing date stays. Google Play accepts it only for an upgrade.                                    |
| `chargeFullPrice`     | The full price of the new subscription, now; what was left of the old one is credited to it.                                                                 |
| `withoutProration`    | The new price, first on the next billing date, which stays.                                                                                                  |
| `deferred`            | Nothing now. The old subscription runs until its next renewal, which renews into the new product.                                                            |

Every mode but `deferred` changes the subscription at once. With `deferred` the purchase answers
`purchased` with a transaction of the old product, and the change shows as the subscription's
`renewsToProductSlug` until the renewal makes it.

Nothing is bought when the replacement cannot be made. The purchase fails with
`REPLACED_SUBSCRIPTION_NOT_OWNED` when the signed-in Google Play account has no paid purchase of
the replaced product, with `INVALID_ARGUMENT` when either product is not a subscription, both are
the same product, or `replacing` names no product or an unknown mode, and with
`SUBSCRIPTION_REPLACEMENT_REFUSED`, with Google Play's reason in the message, when Google Play
rejects the replacement before its sheet opens. A purchase started from a flow cannot name a
replaced subscription yet; start such a purchase with `purchase(...)`. Development mode simulates
the purchase and replaces nothing.

`replacing` only has an effect on Android. On iOS it is accepted and ignored: the App Store moves a
subscriber between the products of one subscription group by itself.

On Google Play, a purchase nobody acknowledges within three days is refunded. Voidhash's servers
acknowledge a purchase the SDK started once they record it, in case the app stops before the SDK
finishes it; they never acknowledge or consume a purchase the SDK did not start. For a purchase
Voidhash has not recorded in time, the SDK keeps a deadline on the device:

- A purchase the SDK starts in owner mode, a pending one too, is recorded on the device until it is
  acknowledged or consumed. Purchases in observer mode and purchases reported with
  `reportTransaction` are never recorded.
- While such a purchase is unfinished, a background job checks it every four hours once the device
  has a network, even when the app is closed. A purchase Google Play still lists as unacknowledged
  36 hours after its payment went through (for a pending payment, after it completes) is
  acknowledged on the device.
- The job runs no JavaScript. When `init()` has run in the app's process, the job uses that
  client: it first lets it deliver its queued receipts, for up to 30 s, and the SDK then finishes
  the purchase as usual. Otherwise queued receipts go out the next time the app opens. When the job acknowledges a purchase whose receipt the SDK still holds, the
  SDK reports `PURCHASE_FINISHED_BEFORE_SYNC` through `onDiagnostic` and delivers the receipt once
  Voidhash is reachable.
- The job only acknowledges, a `one-time-consumable` product too. Such a consumable stays owned, so
  it cannot be bought again until the SDK consumes it once Voidhash records it. One Voidhash never
  records stays owned until you refund it in the Google Play Console, which releases it.

The module adds the job's service, `com.voidhash.core.billing.PlayFinishJobService` (not exported,
started only by JobScheduler), and the `RECEIVE_BOOT_COMPLETED` permission to your app's manifest,
so the check survives a reboot. Without that permission the check is scheduled again whenever the
SDK connects to Google Play.

### Transaction updates

Some purchases complete outside `purchase()`: an approved Ask to Buy, a pending payment that went
through, a redeemed offer code, a promoted purchase, and on iOS a renewal seen on the device
(`transaction.isRenewal`; Google Play does not report renewals to the device, so on Android they
reach the person's subscriptions only). A purchase or restore made in a flow is answered by
`presentFlow()` instead. The SDK handles each one (its receipt goes to Voidhash) and then tells your
listeners:

```ts
const unsubscribe = voidhash.client.addTransactionListener(({ transaction, synced }) => {
  showToast(`${transaction.productSlug} is yours`);
});
```

It is a signal for the UI, not a delivery guarantee: access always comes from the person's
entitlements, which hooks re-render with. A `Transaction` has `id` (the App Store transaction id or
the Google Play purchase token), `productSlug`, `storeProductId`, `store`, `purchasedAt` and
`expiresAt` (milliseconds since the epoch), `quantity`, `offer`, `environment`, and the store's own
`appStore` (with its `jwsRepresentation`) or `googlePlay` (with its `purchaseToken`, `orderId` and
`obfuscatedAccountId`) part.

### Subscriptions

`useSubscriptions()` answers `{ all, current, isLoading, isStale, error, refetch }` from the person
snapshot. `all` lists every subscription that has not ended, including ones in a grace period, in
billing retry, on hold or paused: what a "manage subscription" screen lists. Each has its
`status` (`active`, `trialing`, `inGracePeriod`, `inBillingRetry`, `onHold`, `paused`, `expired`,
`revoked`), `periodType`, `expiresAt`, `willRenew`, `renewsToProductSlug`, `gracePeriodExpiresAt`,
`pendingPrice` and more, as the server knows them across devices and stores. Access comes from
entitlements (`useHasPerk`), never from this list.

### Store actions

| Method                                     | App Store                                                           | Google Play                                      |
| ------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------ |
| `client.showManageSubscriptions(product?)` | The subscription manager, for the product's group on iOS 17+        | The subscriptions page, for the product if given |
| `client.presentCodeRedemption(code?)`      | The offer-code sheet (`code` is ignored)                            | The redeem page with `code`                      |
| `client.getStorefront()`                   | `{ countryCode, currencyCode? }`, the country as ISO 3166-1 alpha-2 | The same                                         |
| `client.canMakePayments()`                 | Whether payments are allowed                                        | Whether billing is available                     |

`voidhash.appStore` (also `client.appStore`) holds what only the App Store has:
`beginRefundRequest(transactionId)`, `subscriptionStatus(groupId)`, `currentEntitlements()`,
`appTransaction()` and `addPurchaseIntentListener(listener)`. `voidhash.googlePlay` holds what only
Google Play has: `showInAppMessages()`, `queryPurchases({ includeSuspended })` and
`isFeatureSupported(feature)`. On the other platform each answers `UNSUPPORTED_PLATFORM`.

Two options shape the App Store's own prompts. `appStoreMessages` (default
`"deferWhileFlowPresented"`) holds StoreKit's messages, such as a price increase to agree to, while
a Voidhash flow is on screen; `"automatic"` shows them at once. `purchaseIntents` (default
`"purchaseWhenReady"`) buys a purchase the user started on the App Store, such as a promoted
in-app purchase, once `init()` has finished; `"manual"` hands it to
`appStore.addPurchaseIntentListener()` to complete with `purchase()`. Intents can arrive as soon as
`init()` starts: the SDK holds the 10 latest until you add the first listener, which gets them at
once.

## Observer mode and transaction reporting

Observer mode lets the SDK coexist with an existing billing integration that keeps owning
purchases, for example during a migration.

```ts
createVoidhashClient("vh_pk_...", { readOnly: true });
```

| Mode                        | Starts purchases | Syncs transactions to Voidhash | Finishes/acknowledges store transactions |
| --------------------------- | ---------------- | ------------------------------ | ---------------------------------------- |
| `readOnly: true`            | No               | Yes                            | No                                       |
| `readOnly: false` (default) | Yes              | Yes                            | Yes (after Voidhash records them)        |

In observer mode `client.purchase()` returns `READ_ONLY_PURCHASE_NOT_ALLOWED`. Reads,
`restorePurchases()`, person attributes, identity, feature flags, and analytics keep working.

Switch at runtime instead of recreating the client:

```ts
voidhash.client.setReadOnly(false); // Voidhash now owns purchases
voidhash.client.isReadOnly; // reflects the latest setReadOnly() call
```

The switch takes effect at the next decision point: purchase gating, the observer's
finish/acknowledge decision, and subsequent requests. A purchase already in flight keeps the mode it
started with.

Observer reconciliation:

- The SDK attaches the native purchase listener first. Every client in the app shares one native
  store connection, which closes when the last client ends.
- Reconciliation runs in the background and does not block `init()`.
- Reconciliation sources are pending transactions and the purchases the store still grants: App
  Store current entitlements, and every Google Play purchase the user owns, including a
  subscription whose auto-renew is off.
- Foreground recovery rescans the store at most once a minute, and so does a connectivity restore.
  An app launched in the background scans at its first activation instead.
- The SDK remembers, on the device, which store transaction Voidhash last accepted for each purchase
  (a subscription series on Apple, a purchase token on Google Play) and who owns it. Scans, observer
  callbacks and repeated reports never send an accepted receipt again. A renewal (a new transaction
  or order) and an App Store revocation are still sent, under the purchase's owner rather than
  whoever is signed in now. A Google Play report names only the purchase token, which can stand for
  a later renewal or revocation, so it is skipped only for 30 minutes after Voidhash accepted it.
- A purchase that already gives another user access stays with that user unless
  `restorePurchases()` or a report marked as a restore sends it. A restore shares, transfers or
  keeps it according to the project's paid access sharing setting.
- On an iOS device where in-app purchases are restricted (Screen Time, device management), purchases
  are still observed, scanned and restored.

### Report purchases from another billing SDK

Call `reportTransaction(...)` after each successful host purchase and for each restored transaction.
Only an Apple transaction ID or Google Play purchase token is required. Voidhash supplies the current
SDK identity and configured bundle/package; the backend fetches and verifies the store purchase.

```tsx
// Apple: keep the transaction ID as a string, preserving every digit.
await client.reportTransaction({ platform: "ios", transactionId });

// Google Play: the purchase token, not the order ID.
await client.reportTransaction({ platform: "android", purchaseToken });
```

You can report as soon as the client exists: a report made while `init()` is still running, while
`end()` is still running, or after `end()`, waits for initialization and is then stored. If the host exposes original
store data instead, the same method accepts a StoreKit JWS string or a Play bridge object with
`originalJson`. Voidhash extracts the identifier internally and discards the remaining payload;
no receipt-decoding dependency is needed in your application.

Legacy `ReportedTransaction` metadata such as `productId`, `purchaseDate`, `quantity`, `receipt`
and `appAccountToken` is optional and discarded. Android's optional `purchaseState` can mark a
report as `pending` or `unspecified`; those reports are ignored until reported as `purchased`.
The original Play JSON's pending state is converted internally. Multi-product bridge purchases
are rejected because the current purchase processing supports one product per purchase.

`reportTransaction()` returns `Result<void, VoidhashError>`. Missing or malformed required
identifiers return `FAILED_TO_REPORT_TRANSACTION`; `VOIDHASH_CLIENT_NOT_INITIALIZED` means the
client could not initialize. Network and delivery failures leave the report queued and return
`Ok`.

Identify the buyer before starting the purchase flow; the call need not be awaited, as a report
waits for the identity calls made before it to switch the person. Reporting never
finishes, acknowledges or consumes a transaction. It writes the identifier to the SDK's on-device
outbox, and the write has reached storage by the time the call returns; delivery runs in the
background. If device storage refuses the write, the report is kept in memory, retried, and
reported as `CACHE_WRITE_FAILED` through `onDiagnostic`. Duplicate reports preserve the original
captured identity across retries and relaunches, and a report of a transaction Voidhash already
accepted is not sent again (a Google Play token report only within 30 minutes of its acceptance). SDK diagnostics describe deferred delivery.

Use `syncPurchases()` for a silent recovery scan when a host callback exposes no usable store
transaction values. It sends receipts already queued on the device, scans currently exposed
purchases, skips receipts already accepted by Voidhash, and refreshes person state. It never moves a
purchase to another user. Store-read failures reach the caller; delivery failures stay queued for
retry. It does not prompt for store authentication.

Connect your Restore Purchases button to `useRestorePurchases()`, which runs `restorePurchases()`
and tracks its loading state and error. `restorePurchases()` answers the refreshed person (`null`
when there is none), so "nothing to restore" needs no second read. `restore` takes no arguments,
so it can go straight to `onPress`; the callbacks work like those of `usePurchase()`:

```tsx
const { restore, isLoading } = voidhash.useRestorePurchases({
  onSuccess: (person) => {
    const restored = person?.entitlements.grants.some((grant) => grant.status === "active");
    Alert.alert(restored ? "Purchases restored" : "Nothing to restore");
  },
  onError: (error) => Alert.alert("Restore failed", error.message),
});

<Button title="Restore purchases" disabled={isLoading} onPress={restore} />;
```

`restorePurchases()` revalidates restorable purchases for the identity that requested the restore, including receipts already accepted for another user.
Only a restore can share or move a purchase that already gives another user access; the
project's paid access sharing setting decides whether both keep access, access moves to the
restoring user, or it stays with the original user. Previously queued purchases retain their
original identity and are delivered before the restore.

On iOS, restore calls `AppStore.sync()` and reads verified non-consumable transaction history;
this may prompt for App Store authentication. Android queries currently owned Play purchases.
Known consumables are excluded from explicit restoration. The restore waits for the current
transaction of each purchase, a few at a time; older transactions of a subscription are revalidated
in the background from the outbox. Once Voidhash cannot be reached, the remaining purchases are
queued without sending. A store error, or a receipt Voidhash could not confirm yet, fails the
restore and the receipt stays queued. A receipt Voidhash refuses with a verdict that cannot change on
its own (for example because the App Store or Google Play is not configured for this app) does not
fail the restore; it is reported through `onDiagnostic` as `TRANSACTION_REJECTED`. An empty store can
restore successfully. Check the refreshed person's entitlements to decide whether to unlock access.
Use silent sync after a host restore for discovery; call explicit restore when Voidhash must
revalidate cached receipts for the current user or give them a purchase another user has. Reports
of a host restore leave such a purchase with its owner unless you mark them as restores. When the
user asked your own billing integration to restore purchases, report each transaction it returns
with `isRestore`: it is sent as an explicit restore for the current user, like
`restorePurchases()`, even when Voidhash already accepted it, and stays one across retries and
relaunches.

```ts
await client.reportTransaction({ platform: "ios", transactionId }, { isRestore: true });
```

Initialization, foreground and reconnect also perform recovery scans (foreground at most once a
minute). Scans cannot recover a consumable already finished or consumed by the host, or arbitrary
expired subscription history. Use explicit reporting whenever transaction values are available.

## Paywalls

Paywalls and multi-screen flows are drawn natively by a renderer the config plugin adds with
`["@voidhash/react-native", { "renderer": true }]`. `client.presentFlow(placement)` (or the
`usePresentFlow(placement)` hook) presents whatever is assigned to the placement and resolves once
it ends, never rejecting:

```ts
const result = await voidhash.client.presentFlow("onboarding");
// { status: "purchased", productSlug } | { status: "restored" } | { status: "closed" }
// | { status: "finished", result, variables } | { status: "failed", error }
```

`failed` carries a `FLOW_*` error code (`FLOW_NOT_ASSIGNED`, `FLOW_UNAVAILABLE`,
`FLOW_RENDERER_MISSING`, `FLOW_UNSUPPORTED_PACKAGE`, `FLOW_PRESENTATION_FAILED`, `FLOW_DISABLED`);
keep your own upgrade screen for it. `client.dismissFlow()` closes the flow on screen. Purchases
and restores started from a flow go through `purchase()` and `restorePurchases()`, so in observer
mode a purchase from a flow fails with `READ_ONLY_PURCHASE_NOT_ALLOWED` and the flow shows the
failure. A failed or cancelled purchase leaves the flow open.

A flow may open links by default. Grant more with `flowCapabilities`: `notifications` and
`tracking` let it ask for those permissions (declare `POST_NOTIFICATIONS` on Android and
`NSUserTrackingUsageDescription` on iOS), and `attributes` lets it set person attributes. A flow
resumes with the answers it saved for the current person until it finishes; a purchase also clears
them in a paywall, but not in an onboarding flow, which keeps going. `identify()` and `reset()` drop
them.

## Feature flags

`useFeatureFlags(keys)` evaluates the flags you name (every flag when you name none) for the current
person, and evaluates them again after `identify()`, `signOut()` or `reset()`:

```tsx
const { isEnabled, getVariantValue, isLoading } = voidhash.useFeatureFlags([
  "new_onboarding",
  "pricing_layout",
]);

if (isEnabled("new_onboarding")) {
  // ...
}

const layout = getVariantValue("pricing_layout"); // "annual-first", or null
if (layout === null && isLoading) return <Spinner />;
```

`getVariantValue(key)` is the value of the variant the flag selected for this person, while the flag
is on. It is `null` while the hook is loading, and once it has loaded when the flag is off, has no
variants, or is unknown, so `null` with `isLoading` means "not known yet" and `null` without it
means "no variant". `getVariant(key)` reports the whole evaluation: `enabled`, the variant's
`variantKey` (an id Voidhash generates, not the value you configured) and its `payload`.

Outside React, `client.getVariantValue(key)` evaluates that one flag and answers the same value in
a `Result`, and `client.getFeatureFlags(keys)` answers every flag's evaluation. Both answer from the
cache first, like every other read (see "Reads are cache-first").

With the types `voidhash-cli types generate` writes, flag keys are typed: `useFeatureFlags`,
`isEnabled`, `getVariant`, `getVariantValue` and `client.getFeatureFlags` take only the project's
flags (archived ones left out), and `getVariantValue` answers the text values of the flag's
variants, such as `"control" | "first_day" | null`. The exported `FeatureFlagKey` and
`FeatureFlagValue<K>` types name them. A flag or variant added after you generated the file is not
in those types until you generate it again, and a variant value outside them can still arrive, so
keep a fallback branch rather than treating the union as exhaustive. Without the file, keys and
values are plain strings.

The first read for a person with nothing cached waits for Voidhash for at most `maxWaitMs`
(2 seconds by default), then answers with no flags; the evaluation carries on, and the hook updates
when it lands. A request gives up after 10 seconds, so a longer wait ends there. Use `defaults` for
what a flag reads as until then and when Voidhash cannot be reached and nothing is cached;
`isEnabled()` answers them on a disabled client too:

```ts
export const voidhash = createVoidhashClient("vh_pk_...", {
  featureFlags: {
    maxWaitMs: 500,
    defaults: { new_onboarding: false, legacy_checkout: true },
  },
});
```

`isEnabled(key)` answers a flag's default while it has no evaluated value, and `false` for a flag
without one. `getFeatureFlags(keys)` answers each key you asked for that has a default and no
evaluated value as a flag without a variant. A default never sets a variant value. `maxWaitMs` must
be zero or a positive integer and each default `true` or `false`: development builds throw
`INVALID_ARGUMENT` for anything else, and release builds ignore it and report
`INVALID_CONFIGURATION` through `onDiagnostic`.

## Offline behavior

Initialization and cached reads tolerate an unreachable backend. Entitlements and flags use the
last known state while analytics and supported writes wait for delivery. Without cached
data, reads return their documented empty or unavailable results; purchases still require a usable
store connection. Invalid inputs, rejected operations and operations without a safe fallback can
still report errors.

Fresh cached reads return immediately; stale reads use a bounded refresh budget. The SDK refreshes
state in the background, but cannot guarantee fresh server state while offline.

### Reads are cache-first

Initialization loads local state without waiting for backend or store connections. An initial
distinct ID is adopted locally and the link from the previous anonymous ID is queued. The option
seeds the first `init()` of the process only: after `end()`, a later `init()` resumes the identity
stored on the device, so a sign-out or an `identify()` since is not undone. On a cold start the
schema can initially be empty; subsequent operations use the refreshed schema when it arrives. A
product, perk or placement the SDK cannot read (one a newer server shapes differently) is left out
and reported as `SCHEMA_ENTRY_SKIPPED`; every other entry is still served.

Requests for selected feature flags can reuse the current identity's cached full evaluation,
including stale evaluations while offline. Subset evaluations never stand in for a full evaluation.

`hasPerk`, `getCurrentPerson` and `getFeatureFlags` answer from the cached value first. When that value is past its refresh window the SDK starts a refresh behind the read and
waits at most 500 ms for it before answering from cache; the refresh keeps running and lands for the
next read, and `useHasPerk` and `useCurrentPerson` re-render when it does. Results carry `isStale`
and, for person snapshots, `isExpired`, so an app that gates high-value content can decide how much
to trust an answer that has not been confirmed in a while. An entry written while the device clock
ran ahead is treated as stale and expired once the clock is corrected.

The server's answer that it has no person for an identity yet (an anonymous customer who has not
set attributes or bought anything) is cached like a snapshot, so those checks do not wait on the
network every time. Only the API's own "person not found" answer counts: an error page from a proxy
or CDN, or a response body the SDK cannot read, keeps the cached snapshot. Queuing `identify()`,
person attributes or a store receipt for that identity makes the next read ask the server again.

Check a perk by the slug configured in Studio. Each grant carries it as `perkSlug` next to `perkId`,
the perk's internal ID:

```ts
const premiumGrant = person?.entitlements.grants.find(
  (grant) => grant.perkSlug === "premium" && grant.status === "active",
);
```

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

Analytics events, person writes and store receipts are written to their own files in the app's
private storage and leave their queue only when the server accepts them. New events are appended, so a long outage does
not rewrite the whole queue on every capture, and nothing is written while delivery is paused. Anything that is not a decision of the Voidhash API keeps the data queued
and retries it with jittered backoff — indefinitely: timeouts and network errors, `408`, `425` and
`429`, every `5xx` (CDN codes such as `522` included), an error page from a proxy or CDN in front
of the API, a `2xx` whose body cannot be read (a captive portal), an open circuit and a paused
authentication gate. A `Retry-After` from the server is honoured, between one and thirty seconds.
The only things that drop an event are the queue cap (1000 events, oldest evicted first, each
eviction reported through `onDiagnostic`) and a refusal the Voidhash API itself returns for the
event: a tagged `4xx` error, or a payload too large to accept. A refused batch is split and sent
again in halves, so only the events refused on their own are dropped, each reported once.

Store receipts go through a separate outbox that is written before the first network call and never
evicts an unacknowledged receipt, so a purchase made during an outage is still reported after the
next launch. While the app is open the outbox retries on a timer of its own, and it is also sent at
launch, on foreground, on reconnect and on `flush()`, always after the queued person writes, so a
receipt lands after the identity link it may depend on. Grants are refreshed once a receipt that
waited is accepted. A receipt leaves the outbox once Voidhash accepted it (now or in an earlier run),
or when it can never be verified (an Android purchase without a purchase token). A receipt Voidhash
refuses with a verdict that cannot change on its own stays queued, but is held back for the rest of
the run (at most six hours) and reported once as `TRANSACTION_REJECTED`. Receipt failures count
toward a circuit of their own, so a store Voidhash cannot verify never holds back entitlement, flag
or schema reads.

`identify()` and `setPersonAttributes()` write to a person-write outbox of their own, stored before
the first request. When the server cannot confirm an `identify()`, the device keeps the new identity
and the link from the previous anonymous ID is sent once the API can be reached again: at the next
launch, foreground, reconnect, `flush()` or successful request, or on the outbox's retry timer. An
anonymous customer who bought something keeps their cached access, flagged stale, until the server
has merged the two identities. Attribute updates for one person are merged, newest value per key,
and wait until any link onto that person has landed. A person write leaves the outbox when the
server applies it or refuses it with a tagged error (reported as `PERSON_WRITE_REJECTED`); it is
never evicted to make room.

`flush()` sends the queued person writes, then store receipts and analytics events, and answers with
the analytics outcome `{ flushed, pending, lastError }`. It waits for receipts for about two seconds;
they keep being delivered past that. A host whose circuit is open is probed again, at most once a
minute. A non-zero `pending` alongside a `lastError` means the events are queued for another
attempt, not lost.

### Launches before the first unlock

iOS can launch an app in the background after the device restarts but before the user has unlocked
it, for example for a VoIP push or a location or Bluetooth event. Until that first unlock the SDK
cannot read its stored identity, caches or queues, so `init()` waits for it: the Provider stays
`initializing`, events captured meanwhile are buffered, and nothing is read or written. Once the
device is unlocked, initialization continues with the stored identity instead of starting over as a
fresh install. If storage still cannot be read, the SDK uses a temporary anonymous ID that it never
saves, and switches to the stored identity as soon as it can read it.

Android starts an app before the first unlock only when the app declares a `directBootAware`
component. `init()` waits there too: the Provider stays `initializing`, nothing is read or written,
and once the device is unlocked initialization continues on its own with the stored identity, caches
and queues. Until then the 100 most recent captures are buffered and every other call behaves as it
does while `init()` is still running; `end()` stops the wait. Android has no temporary identity: the
wait ends with the unlock.

### Background launches

An app launched in the background (a silent push, a background fetch, a location event) starts
without `$app_opened`, the boot refresh and the store scan, and its retry timers wait for the
foreground. Queued person writes, receipts and events are still sent. The held-back refresh and
store scan run at the app's first activation, which records `$app_opened`.

### Refresh triggers

The SDK refreshes on its own at boot (schema, then person and flags), on app foreground and on a
connectivity restore (each at most once a minute), when a read finds a stale value, after a purchase
or a queued receipt is accepted,
and whenever `identify()` or `reset()` changes the identity — which also invalidates the person
snapshot and flag evaluations belonging to the previous one, and discards any refresh that was
already in flight for it. The boot and foreground refreshes fetch the schema, the person and the
flags whatever the cache holds. After a purchase the SDK refreshes grants again at 2 s and 5 s,
because the server needs a moment to turn an accepted receipt into an entitlement. Every person
refresh, including one after a purchase or a restore, reaches mounted `useHasPerk` and
`useCurrentPerson` hooks. After `identify()` or `reset()`, mounted `useHasPerk`, `useCurrentPerson`
and `useFeatureFlags` hooks read again for the new identity without remounting, and the boot and
foreground refreshes re-evaluate every set of flag keys a hook has asked for.

The SDK observes the device's reachability and the app lifecycle itself, so it flushes and refreshes
the moment the device comes back online or the app returns to the foreground. The `connectivity`
option earlier releases used for this is no longer needed; it is still accepted and ignored. A host
whose circuit is open is also probed again after
about 30 s (each failed probe doubles the wait, up to about five minutes, with random spread so
devices do not retry in lockstep), on every app foreground, and on the queues' retry timers. These
windows run on the device's monotonic clock, so changing the device time does not stall them, and a
retry that was scheduled before the clock moved backwards is treated as due.

### Paywalls

A placement whose assignment has ever been resolved on this device is cached and shown during an
outage, and its flow package stays on disk. A placement that has never resolved makes
`presentFlow()` fail with `FLOW_UNAVAILABLE`, a state to retry rather than a failure to report.
`preloadPlacements` downloads flows ahead of the first presentation, and placements the device has
shown before are downloaded again at every launch without being listed. Nothing is resolved or
downloaded at launch when the build does not include the renderer.

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

| Field        | Meaning                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| `kind`       | `transport`, `eviction`, `breaker`, `auth`, `cache`, `configuration` or `consent`. |
| `code`       | Stable identifier, for example `ANALYTICS_EVENT_DROPPED`.                          |
| `operation`  | The SDK operation that produced it, for example `capture`.                         |
| `retryable`  | Whether the SDK will try the same work again on its own.                           |
| `httpStatus` | Present when there was a response.                                                 |
| `message`    | Human-readable detail. Not stable; do not parse.                                   |

Exceptions thrown by the handler are swallowed.

A rejected publishable key (a `401`/`403` that Voidhash itself answered) is reported once as
`{ kind: "auth", code: "AUTHENTICATION_FAILED" }` and pauses the traffic that was refused. A
`401` or `403` from anything in front of Voidhash, such as a proxy or firewall page, is treated as
a temporary failure instead: nothing pauses and the request is retried. API
requests (reads, identity updates, store receipts) and analytics delivery pause separately, so an
analytics proxy that rejects the key does not hold back receipts or entitlement refreshes. Queued
data is kept, so fixing the key and relaunching delivers it. The pause is not permanent: one
request is allowed through every 60 s, and `init()` clears it outright. The first read that has
_nothing_ cached to answer with also fails once with an `AUTHENTICATION_FAILED` `VoidhashError`
when API requests are paused, so a wrong key in development is impossible to miss; every later read
answers from cache as usual.

An invalid `baseUrl` or `ingestUrl` (anything but an absolute `http(s)` URL) throws an
`INVALID_ARGUMENT` `VoidhashError` from `createVoidhashClient` in development builds. Release builds
use the default origin instead and report `{ kind: "configuration", code: "INVALID_CONFIGURATION" }`
once. Whitespace around either value, such as the trailing newline of a value read from an
environment file, is removed.

## Unstable error swallowing

Deprecated. Transport failures no longer surface as errors, so there is nothing left for this flag
to swallow — use `onDiagnostic` to observe failures the SDK recovered from. The flag still works and
will be removed in a future release.

For early-alpha integrations, side-effect methods can log instead of rejecting:

```ts
createVoidhashClient("vh_pk_...", {
  unstable_swallowErrors: true,
});
```

Swallowed (warn, return `Result.ok`): `init()`, `end()`, `identify(...)`, `reset()`, `signOut()`,
`setPersonAttributes(...)`, `restorePurchases()` (answering `null`), `syncPurchases()`,
`showManageSubscriptions()`, `presentCodeRedemption()`. `flush()` is no longer among them: it answers with delivery counts,
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

An event belongs to the person the app last switched to, also when that call was not awaited:

```ts
voidhash.client.identify(user.id); // not awaited
voidhash.client.capture("signed_in"); // recorded for user.id
```

An event, a screen or a purchase report (`reportTransaction()`, `syncPurchases()`) made after an
`identify()`, `reset()` or `signOut()` waits until the device has switched to that person, not for
Voidhash to answer the call, and an event keeps the time it was captured at. The wait is a moment
after `identify()`, and up to about two seconds after a `signOut()` or `reset()` of a signed-in
user, whose last events are sent first. An identity call itself runs after the identity, group and
person calls made before it have settled, so an event behind several of those waits as long as they
take, which on a slow network is seconds each. Waiting events are held in memory, at most 100: past
that the oldest is dropped and reported as `ANALYTICS_EVENT_DROPPED`. `group()` is not part of this:
await it before capturing an event that should carry the group.

Events are batched with these defaults:

- Batch size: `20`
- Flush interval: `5000ms`
- Retries: unlimited. An event stays queued until Voidhash accepts it or refuses it with an API
  error, and is retried with jittered exponential backoff capped at 30 s, honouring `Retry-After`.
  The queue holds at most 1000 events; the oldest is evicted first and reported through
  `onDiagnostic`. See "Nothing queued is lost".

Force delivery with `await voidhash.client.flush()`. `client.end()` waits for a final flush for at
most about two seconds and then writes the queue to the device; whatever it could not send in time
goes out after the next `init()`. The client stops being initialized as soon as `end()` is called:
reads answer `VOIDHASH_CLIENT_NOT_INITIALIZED` from then on, while `init()`, identity calls and
purchase reports made before the teardown has finished wait for it and start the client again.

Property values are copied when the event is captured, into what JSON can hold: a `bigint` is sent
as its decimal string, a `Date` as its ISO string and a non-finite number as `null`, while
functions, symbols, `undefined` and circular references are left out. Changing the object after
`capture()` does not change the event. An event whose properties hold more than 10,000 values, or
have a getter that throws, is dropped and reported as `ANALYTICS_EVENT_DROPPED`; nothing else in
the queue is affected. The app, device and SDK properties (`$app_version`, `$platform_version`,
`$locale`, …) are recorded at capture too, so an event sent after an app update reports the release
it happened in.

The native core reports `$app_crashed` from what iOS and Android record, with `crash_kind` and
`$app_version`, unless `automaticLifecycleEvents` is `false`. Report a notification the end user
opened with `client.trackPushOpened(data)`, passing the data your notification library hands you. It
records `$push_opened` with its `push_notification_send_id`, and ignores a notification Voidhash did
not send.

### Groups

Put the end user in a group, such as the company or workspace they use your app as part of, and
every event captured after the call resolves carries it in `$groups`:

```ts
await voidhash.client.group("company", "acme", { name: "Acme", seats: 40 });
voidhash.client.getGroups(); // { company: "acme" }
await voidhash.client.resetGroups();
```

`group()` and `resetGroups()` wait for `init()` and run in call order with `identify()`, `reset()`
and `signOut()`; they resolve to a `Result`. A group type is a lower-case letter followed by up to 63
lower-case letters, digits or underscores; a key (a number is kept as text) has 1 to 256
characters. Anything else is an `INVALID_ARGUMENT` error. The native iOS and Android SDKs keep the
groups with the distinct id, send a `$groupidentify` with the group's properties when you pass some
or when the group of that type changed, and clear the groups whenever `signOut()` or `reset()`
acts. A group an event names in its own `$groups` wins for its type. Groups and their
properties are sent whatever the analytics consent: without it the `$groupidentify` goes out at
once, on its own, with only the group's type, id and properties, and is not retried if it fails;
the next `setGroups()` sends it again.

`setGroups(groups)` replaces all of them in one call, for an app that knows the user's groups as a
whole:

```ts
await voidhash.client.setGroups({
  company: { id: "acme", name: "Acme", seats: 40 }, // the id, with the group's properties
  team: "design", // an id alone
});
```

A type you leave out, or set to `null` or `undefined`, is dropped without an event, and `{}` behaves
like `resetGroups()`. Call it as often as you like: a `$groupidentify` is sent only for a group
whose id changed or whose properties differ from the ones last sent, so the same call again sends
nothing. An entry with an invalid type or id is left out, and an object without an `id` is an
`INVALID_ARGUMENT` error. It runs in call order with the other
identity calls and resolves to a `Result`.

### Analytics consent

Pass `analyticsConsent: "pending"` (or `"denied"`) until the user has made a choice, then record it:

```ts
await voidhash.client.setAnalyticsConsent("granted"); // or "denied"
voidhash.client.getAnalyticsConsent(); // "granted" | "denied" | "pending"
```

While consent is `"denied"` or `"pending"` the SDK captures, stores and sends no analytics: custom
events, screens, lifecycle and install events, and paywall impressions and interactions are dropped,
and `ANALYTICS_CONSENT_DENIED` is reported once through `onDiagnostic`. Purchases, restores,
entitlements, feature flags and paywalls work as usual. Consent covers what the SDK observes, not
what the app says about the end user: `identify()` (including its email and name), person
attributes and groups are sent whatever the consent, because feature flags and cohorts can target
them. An app that wants nothing sent before consent does not make those calls until then, or
creates the client with `enabled: false`. Requests made without consent tell Voidhash so, and it
then keeps device and app facts, such as the platform and locale, off the person. Withdrawing consent discards every event still queued on the device,
including a batch being sent, and the analytics session. Granting it resumes analytics from that
moment; nothing dropped is replayed, and an install or update the SDK did not report yet is reported
then.

`setAnalyticsConsent()` stores the choice on the device: on later launches it takes precedence over
the `analyticsConsent` option, and `reset()` and `signOut()` keep it.

By default events captured while consent is `"pending"` are dropped. With
`analyticsWhilePending: "buffer"` they are held in memory instead, each with the time it happened:
up to 100 events, the oldest giving way. Nothing is stored or sent meanwhile, and the events do not
survive the app's process. Granting consent records them first, in order and with their own times,
for the identity, groups and session in effect then; denying it discards them. Person attributes
are not held, and `"denied"` never buffers.

With `grantConsentOnIdentify: true` signing in counts as agreement, for apps whose sign-in accepts
their terms: an `identify()` made while consent is `"pending"` grants it, so held events are
recorded for the anonymous id the identify then links to the user. `"denied"` is never overridden.
A consent granted this way is remembered across launches and lasts until the user signs out:
`signOut()` and `reset()` send what was recorded and return the consent to `"pending"`. Calling
`setAnalyticsConsent()` makes the decision the app's own, which `signOut()` and `reset()` keep.

### Ad data sharing

`client.setAdDataSharing(true)` records that the end user agreed to you sharing their purchases with ad platforms, as the
person trait `$ad_data_sharing`. Unlike other person attributes, agreeing needs analytics consent: without it the agreement is left out.
`client.setAdDataSharing(false)` takes it back: analytics consent neither blocks nor discards that. It is stored on the
device and retried until Voidhash has written it, or for 48 hours while Voidhash has no such person, and
it records no analytics. Setting the trait to `false` as a person attribute does the same. Declining
analytics does not take it back by itself, so when someone rejects everything, call both `setAdDataSharing(false)` and `setAnalyticsConsent("denied")`.

### Install attribution

On a new install the native SDKs work out which ad brought the end user and record it on the person as
a touch, which a later `identify()` carries over from an anonymous person. iOS asks Apple Ads through
AdServices. Android reads the Google Play install referrer and, with `metaAppId` set, first asks the
Facebook, Instagram and Facebook Lite apps. No JavaScript is involved. It runs once per install, in the
background, and only while analytics consent is granted: a grant later runs it then, and a withdrawal
cancels it. An install that already held an identity when this SDK version first ran is not read.
`INSTALL_ATTRIBUTION_DEFERRED` reports through `onDiagnostic` that a later launch asks again, up to 10
launches, and `INSTALL_ATTRIBUTION_ABANDONED` that it stopped. Pass `installAttribution: false` to turn
it off.

### Sessions

Every event carries a `session_id`. A session is a run of events with no gap longer than 30
minutes between them: the first capture after a longer gap, including `$app_opened` on a launch
after a long absence, starts a new session. The session is persisted, so it survives restarts and
resumes on the next launch when the timeout has not passed. `signOut()` records `$sign_out` in the
old session and then starts a new one; it does nothing when nobody is signed in. `reset()` does
exactly what `signOut()` does for a signed-in user. When nobody is signed in it starts a fresh
anonymous visitor, with a new id, no groups and a new session, without recording `$sign_out`: for
shared devices, a guest's "start over", and tests. `voidhash.client.getSessionId()` returns the active session
id synchronously, or `undefined` before `init()`, once the session has timed out and while analytics
consent is not granted. Reading it never starts or extends a session.

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
to skip; a `mapScreen` that throws, or returns a screen whose `identity`, `name` or `path` is not a
string, tracks the screen unmapped and reports `HOST_CALLBACK_FAILED`) and turn the feature off with
`screenTracking: { enabled: false }`. Screen tracking never throws into your navigation: a screen
that cannot be tracked, such as a `screen()` call whose name is not a string, is dropped and
reported as `ANALYTICS_EVENT_DROPPED`.

### Ingest URL configuration

Ingestion uses the `/i/v1/...` path prefix on the same origin as `baseUrl`. Pass `ingestUrl` to
point analytics at a different host during local development:

```ts
createVoidhashClient("vh_pk_...", {
  baseUrl: "http://localhost:1337",
  ingestUrl: "http://localhost:1339",
});
```

# Contributing

## Native artifact smoke tests

`pnpm test:artifact ios` packs the SDK and the native packages it depends on, installs them in an
isolated Expo 55 project with the peer versions from the packed manifest, and checks prebuild and
Podfile idempotency. It fails when the packed package references a private workspace package, when
the documented install commands pin other peer versions, or when the README's bare React Native
Podfile line does not resolve the installed core package. Set `EXPO_SMOKE_VERSION` to test another
Expo version, and add `--with-react-native-iap` to install the latest `react-native-iap` next to
the SDK and check that both accept the same Nitro version. Add `--compile` to compile the packed
Swift and C++ bridges with Xcode and CocoaPods and check that the app contains the core privacy
manifest. `pnpm test:artifact android --compile` checks the packed Kotlin and JNI/C++ bridges with
the Android SDK and JDK 17. The runner prints its temporary fixture path for inspection.

UUID generation uses native platform APIs and needs no app-owned Web Crypto polyfill. Rebuild
the native app after updating the SDK so its Nitro specs and native implementation match.

## Migrating to the billing API

The product, purchase and person types changed to match the iOS and Android SDKs.

- Products are a union on `type` (`subscription`, `consumable`, `nonConsumable`,
  `nonRenewingSubscription`). `id` is gone: use `storeProductId` (the store's id) or `productId`
  (Voidhash's). `displayPrice`, `price` and `currency` became `price.formatted`, `price.amount` and
  `price.currencyCode`; `interval` became `subscription.period`; `platform` became `store`; the
  Google Play offer tokens moved to `googlePlay.subscriptionOffers`.
- `client.getProducts()` answers an array sorted by slug instead of a record of `Option`s, and
  `useProducts()` adds `products`; `data.bySlug` holds `undefined`, not `null`, for a missing product.
- `purchase()` answers `purchased` with the transaction and `synced` instead of `completed` and
  `deferred`, waits for `init()`, and takes `offer` instead of `offerId`. Replacement modes are
  camelCase (`withTimeProration`, …) and add `deferred`.
- `restorePurchases()` answers the refreshed person instead of nothing; `useRestorePurchases`'s
  `onSuccess` receives it.
- The person (`useCurrentPerson().data`, `getCurrentPerson()`) is a `Person`: timestamps are
  milliseconds since the epoch, absent values are absent instead of `null`, store and status values
  are camelCase (`appStore`, `inGracePeriod`), and `subscriptions.all` lists every subscription that
  has not ended. `hasPerk()` answers `grant` as a value or `undefined` instead of an `Option`.
- `iosPresentCodeRedemptionSheet()` and `iosShowManageSubscriptions()` became
  `presentCodeRedemption()` and `showManageSubscriptions()` on both platforms, and the
  `appStore.useRetrieveProduct(s)` and `googlePlay.useRetrieveProduct(s)` placeholders became the
  `appStore` and `googlePlay` actions.
- A flow's `purchased` result names the product by `productSlug`.
- Hooks outside the provider throw in development builds.

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
  `deferred` result means the server could not confirm the update yet (it was unreachable, the key
  was rejected, or an earlier write for the person is still queued) and the update is queued.
- `identify()` and person attributes no longer ride the analytics queue: they are sent to the person
  API from their own outbox, and no `$identify` or `$set` event is captured for them. Attribute
  values must be strings, numbers, booleans or `null`; a nested object or an array returns
  `INVALID_ARGUMENT` whether or not the device is online.
- `flush()` returns `{ flushed, pending }` instead of `void`.
- React hooks return plain values instead of `Option`s: `error` (every hook) and
  `useHasPerk().grant` are `null` when absent, `useFeatureFlags().getVariant(key)` returns
  `{ enabled, variantKey, payload }` or `null`, `useProducts().data.get(slug)` returns the product or
  `undefined`, and `useVoidhash().initError` is `null` unless initialization failed. Flag results, including `client.getFeatureFlags()`, carry
  `variantKey` as `string | null` and the variant's `payload`.
- The provider reports `status: "failed"` when `init()` fails, instead of `"ready"`, so the
  `retryInit()` path is reachable. Hooks report `isLoading: true` while the provider initializes.
- `presentFlow()` answers `{ status: "failed" }` with `FLOW_UNAVAILABLE` for a placement that has
  never been resolved on this device while the server is unreachable.
- `setPersonAttributesSync(...)` on a client created with `enabled: false` now answers
  `{ status: "disabled", person: null }` rather than `deferred` — nothing was recorded, and nothing
  is queued.
- The SDK no longer uses `AsyncStorage`. Its small cached values (the distinct ID, person snapshot,
  flags, schema and session) live in the platform key-value store the native SDKs also use:
  `UserDefaults.standard` on iOS and a private `SharedPreferences` file on Android, namespaced under
  `vh:<version>:<hash>:` so they cannot collide with your app's own keys. The analytics queue,
  person writes and store receipts are files in the app's private storage. Nothing is imported from
  `AsyncStorage`: an install upgrading from a pre-release build that stored its state there starts
  with a new anonymous identity, records `$app_installed` again and loses events that were still
  queued. An anonymous customer who bought something on that build gets their access back with
  `restorePurchases()`.
- Call `identify` as early as you know the user: the SDK invalidates and refetches the per-person
  state for you. `identify("")` (or an ID of only whitespace) returns an `INVALID_ARGUMENT` error
  and leaves the identity unchanged. IDs may contain any Unicode text, such as `jürgen` or `用户42`.
- `reportTransaction(...)`, `syncPurchases()` and `restorePurchases()` wait for initialization
  instead of returning `VOIDHASH_CLIENT_NOT_INITIALIZED`, so a purchase callback that fires during
  launch is no longer lost. A receipt Voidhash already accepted is not sent again by scans, observer
  callbacks or repeated reports, and only an explicit restore (`restorePurchases()`, or a report
  marked `isRestore`) asks Voidhash to move a purchase to the current user. A receipt Voidhash refuses permanently is reported as `TRANSACTION_REJECTED`
  and no longer fails `restorePurchases()`.
