# Error Handling in Voidhash React Native

This document describes how the Voidhash React Native package reports failures.

## Overview

Every fallible client method returns a better-result `Result<T, VoidhashError>` and never rejects.
`VoidhashError` (in `src/errors.ts`) carries a stable `code` typed as `VoidhashErrorCode`; the full
list is exported as `VOIDHASH_ERROR_CODES`. Match on `error.code`, not on the message text:

```typescript
const result = await client.getCurrentPerson({ forceFetch: true });
if (result.isErr() && result.error.code === "FAILED_TO_GET_CURRENT_PERSON") {
  // branch on the failing operation
}
```

The work behind each method runs in the native Voidhash client of the platform (the iOS and Android
SDKs). A native failure has the shape

```
ERROR_CODE: descriptive message
```

and the client method reports it under its own code, such as `FAILED_TO_GET_CURRENT_PERSON` or
`FAILED_TO_PURCHASE`, with the native message kept as the error's message. A call made before
`init()` or after `end()` is `VOIDHASH_CLIENT_NOT_INITIALIZED`, and `init()` reports every failure as
`FAILED_TO_INITIALIZE_VOIDHASH_CLIENT`. The codes below are the exceptions a method passes through
unchanged.

## Codes passed through

### Paywall Errors

- `PAYWALL_UNAVAILABLE`: No paywall configuration has ever been cached for this placement and the
  server cannot be reached. Not a failure: hide the paywall and try again once the device is back
  online. `getPaywallForLocation()` returns it as an `Err`; `presentFlow()` reports it as
  `FLOW_UNAVAILABLE`.

`presentFlow()` never rejects. A flow that could not be shown resolves as `{ status: "failed" }`
with one of these codes:

- `FLOW_NOT_ASSIGNED`: No published paywall is assigned to the placement.
- `FLOW_UNAVAILABLE`: Nothing is cached for the placement and the server cannot be reached, or its
  flow package could not be downloaded or verified.
- `FLOW_RENDERER_MISSING`: The build does not include the flow renderer (config plugin option
  `renderer: true`).
- `FLOW_UNSUPPORTED_PACKAGE`: The paywall was published in a format this SDK version cannot draw.
- `FLOW_PRESENTATION_FAILED`: There was nothing to present from, or the renderer failed.
- `FLOW_DISABLED`: The client was created with `enabled: false`.

### Purchase Errors

- `FAILED_TO_PURCHASE`: The purchase failed; nothing was bought. `error.reason` is set when the
  store said why: `ineligibleForOffer` on both platforms (Google Play refused an offer the account
  can't get, or the App Store refused a promotional or win-back offer), `paymentDeclined` on Google
  Play only (StoreKit reports no declined payment). The products reload after `ineligibleForOffer`.
- `PURCHASE_IN_PROGRESS`: Another purchase was still running; nothing was bought.
- `OFFER_UNAVAILABLE`: `purchase()` named an offer that cannot be bought now; nothing was bought.
  The products reload.
- `REPLACED_SUBSCRIPTION_NOT_OWNED`: Android. `purchase()` named a subscription to replace
  (`replacing`) that the signed-in Google Play account has no paid purchase of; nothing was bought.
- `SUBSCRIPTION_REPLACEMENT_REFUSED`: Android. Google Play rejected the replacement `purchase()`
  asked for before its sheet opened, with its reason in the message; nothing was bought.
- `READ_ONLY_PURCHASE_NOT_ALLOWED`: `purchase()` or `setPersonAttributesSync()` was called while
  the client observes another store owner (`setReadOnly(true)`).

### Store Action Errors

- `UNSUPPORTED_PLATFORM`: An `appStore` action on Android, or a `googlePlay` action on iOS.
- `FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS`, `FAILED_TO_PRESENT_CODE_REDEMPTION`,
  `FAILED_TO_GET_STOREFRONT`, `FAILED_TO_CHECK_CAN_MAKE_PAYMENTS`: the store action failed, with
  the store's code in the message.
- `FAILED_TO_BEGIN_REFUND_REQUEST`, `FAILED_TO_GET_SUBSCRIPTION_STATUS`,
  `FAILED_TO_GET_CURRENT_ENTITLEMENTS`, `FAILED_TO_GET_APP_TRANSACTION` (App Store) and
  `FAILED_TO_SHOW_IN_APP_MESSAGES`, `FAILED_TO_QUERY_PURCHASES`, `FAILED_TO_CHECK_FEATURE_SUPPORT`
  (Google Play): the store action failed, with the store's code in the message.

### Argument Errors

- `INVALID_ARGUMENT`: A method or option received a value it can never work with — a blank distinct
  id passed to `identify()`/`identifySync()`, a person attribute that is not a string, number,
  boolean or `null` (a nested object or an array) passed to `setPersonAttributes()` or
  `setPersonAttributesSync()`, a group type or key `group()` cannot keep (see the README's
  Groups section), a `replacing` option of `purchase()` that names no product or an
  unknown mode, or (on Android) one whose product is not a subscription or is the product being
  bought, a `quantity` other than 1 for anything but an App Store consumable, an `offer` that names
  nothing, or (in development builds, thrown by `createVoidhashClient`) a `baseUrl`/`ingestUrl` that
  is not an absolute `http(s)` URL or an unknown `analyticsConsent`. A programmer error: fix the
  call site rather than retrying. Nothing is sent, queued or bought.

## Native store codes

The native clients use these codes for store failures. They reach the app inside the message of the
method's own code (for example `FAILED_TO_PURCHASE: USER_CANCELLED: User cancelled the purchase`),
and are shared by the iOS and Android SDKs where both platforms have the failure.

### Product Errors

- `INVALID_PRODUCT_ID`: Product not found in store
- `EMPTY_SKU_LIST`: No SKUs provided for product query
- `SKU_NOT_FOUND`: The SKU was not found. Please fetch products first by calling getItems
- `SKU_OFFER_MISMATCH`: The number of SKUs must match the number of offer tokens for subscriptions

### Purchase Errors

- `STOREKIT_NOT_INITIALIZED`: StoreKit connection not initialized
- `GOOGLE_BILLING_NOT_INITIALIZED`: Google Billing connection not initialized
- `PURCHASE_FAILED`: Purchase operation failed
- `USER_CANCELLED`: User cancelled the purchase
- `PURCHASE_PENDING`: The payment was deferred
- `PURCHASE_UNKNOWN_RESULT`: Unknown purchase result

### Transaction Errors

- `TRANSACTION_NOT_FOUND`: Transaction not found
- `TRANSACTION_VERIFICATION_FAILED`: Transaction verification failed

### Platform-specific Errors

- `WINDOW_SCENE_NOT_FOUND`: Could not find window scene for UI presentation
- `PAYWALL_PRESENTER_NOT_AVAILABLE`: Could not resolve active UIViewController
- `CURRENT_ACTIVITY_NULL`: Current activity returned null
- `ITEM_ALREADY_OWNED`: Android. Google Play says the user already owns the product, so `purchase()`
  cannot buy it again. Offer to restore instead. The SDK then checks the store in the background and
  delivers and finishes what it owns of the product, so a consumable can be bought again afterwards.
- `STORE_UNAVAILABLE`: Android. Google Play could not be reached or cannot bill right now: its
  service is disconnected or unavailable, billing is unavailable on the device, or the network
  failed (Play Billing responses `-1`, `2`, `3` and `12`), including Play's billing service going
  away while the purchase sheet is open. `purchase()` reports it besides the calls that list
  products or owned purchases. Trying again later may work. After `purchase()` fails this way the
  SDK cannot always tell whether the user completed the purchase first; if they did, it finds the
  purchase on its next check of the store and syncs and finishes it like any other.
- `BILLING_ERROR`: Any other failure Google Play reported

## What is not an error

Transport failure is an expected state, not an error. Every response is classified the same way,
on every request the SDK makes:

- A `401`/`403` carrying a Voidhash API error: the publishable key was rejected. That traffic
  pauses and queued data is kept.
- A timeout, a network or TLS error, `408`, `425`, `429`, any `5xx` (CDN codes such as `520`–`530`
  included), a `4xx` whose body is not a Voidhash API error (an edge, firewall or proxy page, a
  `401` or `403` included), or a `2xx`
  whose body cannot be decoded: transient. The data is kept, the SDK backs off (honouring
  `Retry-After` between one and thirty seconds) and the failure counts toward the circuit breaker.
  One exception: a project schema the SDK received but cannot read is reported and retried on the
  next refresh without counting toward the breaker, so it never holds up person and flag reads.
  For `GET /person`, only the API's tagged `404` means the person does not exist; any other `404`
  or unreadable body keeps the cached snapshot.
- A `4xx` carrying a tagged Voidhash API error, or a `413`: a verdict re-sending cannot change.

A transient failure never produces a `VoidhashError`:

- Reads (`hasPerk`, `getCurrentPerson`, `getFeatureFlags`, `getPaywallForLocation`) answer from the
  cached value and mark it `isStale`.
- Writes that can wait (`capture`, `identify`, `setPersonAttributes`, `setPersonAttributesSync`,
  store receipt sync) are queued on device and retried until the server accepts them.
  `identifySync` and `setPersonAttributesSync` report this as `{ status: "deferred" }`, and a
  deferred identify keeps the new identity.
- `init()` resolves once local state is loaded, whatever the network is doing.

The only failures the SDK cannot absorb are reads for which no fallback exists — a paywall placement
it has never resolved (`PAYWALL_UNAVAILABLE`), or a read with an empty cache behind a rejected
publishable key (`AUTHENTICATION_FAILED`, surfaced once) — verdicts of the Voidhash API on a direct
write (`identify()`, `identifySync()` and `setPersonAttributesSync()` return them as an `Err`), and
programmer
errors such as calling a method before `init()` (`VOIDHASH_CLIENT_NOT_INITIALIZED`) or passing a
blank distinct id (`INVALID_ARGUMENT`). Identity calls, `reportTransaction(...)`, `syncPurchases()`
and `restorePurchases()` wait for initialization instead, and answer
`VOIDHASH_CLIENT_NOT_INITIALIZED` only when it fails.

Failures the SDK recovered from are reported through the `onDiagnostic` client option instead of the
error channel. Diagnostics carry a `kind` (`transport`, `eviction`, `breaker`, `auth`, `cache`,
`configuration`), a stable `code`, the `operation`, and whether the SDK will retry. Notably:

- `AUTHENTICATION_FAILED` — Voidhash rejected the publishable key (a `401`/`403` carrying a
  Voidhash API error). API requests and
  analytics delivery pause separately, so only the refused traffic waits, and queued data is kept:
  fixing the key and relaunching delivers it. Reported once per pause.
- `INVALID_CONFIGURATION` — a release build ignored a `baseUrl` or `ingestUrl` that is not an
  absolute `http(s)` URL, or an unknown `analyticsConsent`, and uses the default instead. Reported
  once per option.
- `HOST_CALLBACK_FAILED` — a callback the app handed the SDK threw: a `usePurchase` callback (or the
  promise it returned rejected) or `screenTracking.mapScreen`, which is also reported when it returns
  a screen whose `identity`, `name` or `path` is not a string. The SDK
  carried on without it: the purchase keeps its result and the hook settles, and the screen is tracked
  unmapped.
- `CACHE_WRITE_FAILED` — a write to device storage failed. The value is still held in memory and the
  next write retries. Also reported, as not retryable, for a value that cannot be encoded as JSON;
  it is kept in memory but not written to disk.
- `BACKGROUND_TASK_FAILED` — an SDK-owned background task (a refresh chain, an outbox sync, a run of
  the analytics flush or persist loop) failed outright rather than degrading. The analytics loops
  keep running.
- `TRANSACTION_RECEIPT_DROPPED` — a queued receipt can never be verified (for example an Android
  purchase with no purchase token) and was discarded.
- `TRANSACTION_SYNC_DEFERRED` — a receipt is still queued after a failed sync attempt.
- `PURCHASE_FINISHED_BEFORE_SYNC` — Android only: a purchase the SDK started was still not recorded
  by Voidhash 36 hours after its payment went through, so the background check acknowledged it on
  the device before Google Play refunds it. The SDK still holds the receipt and delivers it.
- `LEGACY_IMPORT_SKIPPED` — iOS only: what an earlier release of this package stored on the device
  was not carried over, because the storage it was kept under doesn't match the configured base URL.
  Reported once per start.
- `TRANSACTION_REJECTED` — Voidhash refused a store receipt with a verdict that cannot change on its
  own: the App Store or Google Play is not configured for this app, or the transaction is unknown or
  from another environment. The receipt stays queued, is held back for the rest of the run (at most
  six hours) and is sent again at the next launch. It does not fail `restorePurchases()` or
  `syncPurchases()`. Reported once per receipt.
- `PERSON_WRITE_REJECTED` — a queued `identify()` link or person-attribute update was dropped
  because the Voidhash API refused it with a verdict re-sending cannot change (a tagged `4xx`, such
  as a validation error or an anonymous ID already linked to another user). Reported once per write.
- `ANALYTICS_EVENT_DROPPED` — an event was evicted because the queue reached its 1000-event cap; the
  ingest API refused it with a verdict re-sending cannot change (a refused batch is split until only
  the refused events are dropped); its properties could not be copied at capture (more than
  10,000 values, or a getter that throws); or a screen could not be tracked (a name that is not a
  string, or route params that cannot be read).
- `CIRCUIT_OPEN` — a host failed transiently five times in a row, so requests to it are skipped and
  the cache is served until the next probe, about 30 s later (doubling per failed probe, up to about
  five minutes).
- `CACHE_READ_FAILED` — device storage could not be read, or an unreadable cache entry was
  discarded and treated as a miss. A value that could not be read counts as unknown, not absent: the
  SDK does not overwrite a queue, an outbox or a stored identity it could not read, and reads again
  later.
- `SCHEMA_ENTRY_SKIPPED` — a product, perk or paywall location in the project schema has a shape
  this SDK version cannot read, so it was left out; every other entry is still served. Updating the
  SDK makes the entry available. Not retried.

## Adding New Error Codes

1. Report it from both native clients with the `CODE: message` shape, using the same code on both
   platforms.
2. If apps need to branch on it, add it to `VOIDHASH_ERROR_CODES` in `src/errors.ts` and to the
   `passThrough` codes of the methods that report it in `src/core/native/native-client.ts`.
   Otherwise it reaches the app inside the method's own code and needs no change here.
3. Update this documentation.
