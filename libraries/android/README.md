# @voidhash/android

The bare Voidhash Android SDK plus the shared native core every Voidhash Android surface reuses.

> **Initial release:** SDK-started purchases and hosted paywalls are temporarily unavailable. The
> SDK observes and submits Google Play transactions to Voidhash for revenue analytics, but never
> acknowledges or consumes them. The host billing integration remains the transaction owner.

Two Gradle modules live here:

- **`:sdk`** (`com.voidhash.sdk`) — the public SDK: configuration, identity, products, transaction
  reporting, feature flags and analytics.
- **`:core`** (`com.voidhash.core`) — the shared engine. The React Native SDK includes its sources
  directly; `:sdk` depends on the module.

## Install

The SDK is published as an Android library module inside this npm package. Add it to your Gradle
build by pointing at the checked-out package directory:

```kotlin
// settings.gradle.kts
includeBuild("node_modules/@voidhash/android")
```

or, when vendoring the sources, copy `core/` and `sdk/` into your build and include them:

```kotlin
include(":voidhash-core", ":voidhash-sdk")
project(":voidhash-core").projectDir = file("third_party/voidhash/core")
project(":voidhash-sdk").projectDir = file("third_party/voidhash/sdk")
```

```kotlin
// app/build.gradle.kts
dependencies {
    implementation(project(":voidhash-sdk"))
}
```

Requirements:

- Android Gradle Plugin 8.9.0, Kotlin 2.0.21, Java 8 bytecode target
- `minSdk` 23, `compileSdk` 34
- The Android SDK resolved via `ANDROID_HOME` (or a local, uncommitted `local.properties`)
- Play Billing 8.0.0, Play Services Base, OkHttp 4.x and kotlinx-coroutines on the runtime
  classpath

`:sdk` contributes `android.permission.INTERNET` through its manifest, so only the billing
permission has to be added to your app:

```xml
<uses-permission android:name="com.android.vending.BILLING" />
```

## Configure

```kotlin
import com.voidhash.sdk.Voidhash
import com.voidhash.sdk.VoidhashOptions

class App : Application() {
    override fun onCreate() {
        super.onCreate()

        val voidhash = Voidhash.configure(
            context = this,
            publishableKey = "pk_live_…",
            options = VoidhashOptions(debug = BuildConfig.DEBUG),
        )

        ProcessLifecycleOwner.get().lifecycleScope.launch {
            try {
                voidhash.initialize()
            } catch (error: Throwable) {
                Log.w("Voidhash", "Voidhash failed to initialize", error)
            }
        }
    }
}
```

`configure` is synchronous and cheap; `initialize()` loads local state and starts the Google Play
connection, schema refresh and unfinished-purchase reconciliation in the background. The client is also reachable
as `Voidhash.shared` afterwards.

`initialize()` never fails because Voidhash is unreachable, slow, or returning 5xx. It
resolves as soon as local state has loaded and keeps trying for the schema in the background
for as long as the app runs, so a cold, offline start still gives you a working client and
you never have to call it again. The `try`/`catch` above is there for programmer errors only
— a coroutine launched from `onCreate` that throws would otherwise take the process down.

## Offline behaviour

Requests for selected flags reuse the same identity's cached full evaluation when no exact
evaluation is cached, including stale values offline. A subset never substitutes for a full evaluation.

Initialization and cached reads tolerate an unreachable backend. Entitlements, flags and paywalls
use the last known state while analytics and supported writes wait for delivery. Without cached
data, reads return their documented empty or unavailable results; purchases still require a usable
store connection. Offline state is not guaranteed to reflect the latest server state. Queue capacity,
invalid events and storage failures still impose durability limits.

What _can_ still throw is a definite answer from a healthy server — a `422` on a malformed
`identify`, for instance — or a programmer error such as starting a purchase before the SDK
knows about any products. Those are not transport problems and have no sensible fallback.

- **Reads are cache-first.** `getCurrentPerson`, `getFeatureFlags` and `resolvePaywall` answer from
  the last known state immediately and refresh behind the read. A read that finds a stale value
  waits at most 500 ms for the refresh before serving what it has.
- **Cached values are never discarded for being old.** An expired entry is still served, flagged
  `isExpired`. Use the `…State()` variants when you need to know: `getCurrentPersonState()`,
  `getFeatureFlagsState()`, `resolvePaywallState()`.
- **Queued data is never dropped for transport.** Analytics events and store receipts are written
  to disk and retried indefinitely with backoff. Only the queue cap (1000 events, oldest first) or
  a non-retryable server verdict drops anything, and both emit a diagnostic.
- **Receipts survive process death.** A store receipt reaches disk before the sync request goes
  out and is removed only once the backend accepts it.
- **Writes are applied locally and queued.** `identify`, `setPersonAttributes` and
  `syncStoreTransaction` never fail for transport. They take effect on the device
  immediately and report `WriteStatus.DEFERRED`; the SDK delivers them when the backend is
  reachable again. Use the `…WithStatus` variants when you want to know which happened.
- **The SDK refreshes itself.** Boot, app foreground, connectivity restored, `identify`/`reset`,
  and TTL expiry all trigger a refresh. You never have to call one. The schema retries for
  as long as the app runs, so a device that starts offline still ends up configured without
  the host calling `initialize()` again.
- **Nothing touches storage on your thread.** `configure` and `capture` return without
  reading or writing a file; all persistence runs on the SDK's own writer thread.
- **A store surface with no schema degrades rather than throws.** `getProducts()` returns an
  empty list and `restorePurchases()` still reconciles the store.

```kotlin
when (voidhash.identifyWithStatus("user-123", email = "a@b.co").status) {
    WriteStatus.CONFIRMED -> Unit // the backend has it
    WriteStatus.DEFERRED -> Unit  // applied locally, queued for delivery
}
```

```kotlin
val person = voidhash.getCurrentPersonState()
if (person.isExpired) {
    // Older than its two-day lifetime. Still the best answer available, but decide for yourself
    // whether it may gate high-value content.
}
```

Diagnostics report anything the SDK handled on its own:

```kotlin
VoidhashOptions(
    preloadPlacements = listOf("onboarding"),
    onDiagnostic = { diagnostic ->
        when (diagnostic.kind) {
            VoidhashDiagnosticKind.AUTH -> Log.e("Voidhash", diagnostic.message)
            else -> Log.d("Voidhash", "${diagnostic.code}: ${diagnostic.message}")
        }
    },
)
```

A rejected publishable key (401/403) pauses outbound traffic for the process, keeps every queue on
disk, and reports once through `onDiagnostic` with `kind = AUTH`.

`VoidhashOptions`:

| Option              | Default                    | Meaning                                                             |
| ------------------- | -------------------------- | ------------------------------------------------------------------- |
| `baseUrl`           | `https://api.voidhash.com` | Voidhash API origin                                                 |
| `ingestUrl`         | `baseUrl`                  | Analytics ingest origin                                             |
| `debug`             | `false`                    | Reports the build as a debug build and enables verbose logging      |
| `distinctId`        | `null`                     | Pins the initial distinct id instead of generating an anonymous one |
| `enabled`           | `true`                     | When false the client is inert: no network, no billing connection   |
| `readOnly`          | `true`                     | Forced on while commerce features are unavailable                   |
| `dev`               | `false`                    | Reserved for SDK-started test purchases                             |
| `preloadPlacements` | `emptyList()`              | Paywall locations to fetch and cache on the first launch            |
| `onDiagnostic`      | `null`                     | Receives structured reports about situations the SDK handled itself |

## API

Every method on `VoidhashClient` other than `capture`, `getDistinctId` and `setReadOnly` is a
suspending function.

### Products and transaction reporting

```kotlin
val products = voidhash.getProducts()
// Reads Play history, submits transactions to Voidhash, and refreshes the person.
voidhash.restorePurchases()
```

Initialization installs the Play purchase observer and reconciles existing transactions. Observed
and restored transactions are sent to `sync-transaction` with observer mode enabled, and are left
unacknowledged for the host billing integration.

`purchase(...)` is retained for the upcoming commerce launch but currently raises
`READ_ONLY_PURCHASE_NOT_ALLOWED` before Play Billing is touched. Passing `readOnly = false` or
calling `setReadOnly(false)` cannot transfer store ownership to Voidhash in this release.

### Identity

```kotlin
voidhash.getDistinctId()
voidhash.identify(externalUserId = "user-123", email = "a@b.co", name = "Ada")
voidhash.setPersonAttributes(mapOf("plan" to "pro"))
val person = voidhash.getCurrentPerson(forceFetch = true)
person?.activePerkIds
voidhash.reset()
```

### Feature flags

```kotlin
val flags = voidhash.getFeatureFlags(listOf("new_onboarding"))
val enabled = flags.firstOrNull { it.key == "new_onboarding" }?.enabled == true
```

### Analytics

```kotlin
voidhash.capture("checkout_started", mapOf("source" to "paywall"))
voidhash.flush()
```

Events are batched (20 events or every 5 seconds) and persisted to disk within 250 ms of capture,
so they survive the process being killed. Retries are unbounded and backed off, honouring
`Retry-After` from the response header and body. `flush()` returns a `FlushStatus` describing what
went out and what is still queued; it never throws for transport.

```kotlin
val status = voidhash.flush()
status.flushed // events the server accepted
status.pending // events still queued
status.lastError // why the flush stopped early, if it did
```

### Paywalls

Hosted paywalls are temporarily unavailable. Their compatibility surface remains in the package
for the upcoming launch, but it performs no network or presentation work: `presentPaywall(...)`
returns `false` and `resolvePaywall(...)` returns `null`.

Once available, a paywall configuration is cached for seven days and a location the device has
resolved before is preloaded on the next launch, so `presentPaywallForStatus(...)` renders without
waiting on the network. `preloadPlacements` covers the first launch, which has nothing to remember
yet.

```kotlin
when (voidhash.presentPaywallForStatus(activity, "onboarding")) {
    PaywallStatus.SHOWN -> Unit
    PaywallStatus.NOT_ASSIGNED -> Unit // no paywall configured for this location
    PaywallStatus.UNAVAILABLE -> Unit // nothing cached and the API is unreachable
}
```

### Shutdown

```kotlin
val status = voidhash.shutdown()
```

Writes anything captured but not yet persisted to disk, flushes analytics, and ends the Play
Billing connection. Returns the same `FlushStatus` as `flush()`.

## Migrating from earlier alpha releases

These are behaviour changes, not API removals. Existing call sites keep compiling.

- **`initialize()` no longer throws for transport.** It used to raise `FAILED_TO_FETCH_SCHEMA` on
  a cold cache with no connectivity, which crashed apps calling it from a bare
  `lifecycleScope.launch`. It now resolves once local state has loaded. Store operations
  (`getProducts`, `purchase`, `restorePurchases`) still raise `CONFIGURATION_MISSING` while no
  schema is known.
- **Analytics and lifecycle observation start before the schema fetch**, so a cold offline launch
  no longer disables analytics for the process.
- **Expired cache entries are served instead of discarded.** Reads that used to return `null` for
  an entry past its TTL now return it with `isExpired = true`.
- **Analytics batches are no longer dropped after three send attempts.** Retries are unbounded;
  only the queue cap or a non-retryable server verdict drops an event.
- **`flush()` and `shutdown()` return `FlushStatus`** instead of `Unit`. Callers ignoring the
  result are unaffected.
- **`presentPaywall` returning `Boolean` is deprecated** in favour of `presentPaywallForStatus`,
  which distinguishes an unassigned location from an unreachable one.
- **Cache keys are namespaced** by publishable key and API origin, and the schema moved from
  one entry per app version to a single `schema:current` entry. The first launch on the new
  version adopts everything an earlier release stored — the distinct id, the analytics
  session, the last seen app release, receipts, the schema — so upgrading devices keep their
  identity and do not re-fire `$app_installed`. Nothing has to be cleared.
- **`identify`, `setPersonAttributes` and `syncStoreTransaction` no longer throw for
  transport.** They queue instead. Code that caught those exceptions to build its own retry
  can drop it; the `…WithStatus` overloads report whether a write is confirmed or deferred.
- **`getProducts()` and `restorePurchases()` no longer raise `CONFIGURATION_MISSING`** when
  the schema has not arrived yet. `purchase()` still does: starting a purchase for a product
  the SDK cannot describe has no safe fallback.
- **A store receipt is never dropped on an ambiguous answer.** A 2xx that does not say
  whether it was accepted keeps the receipt queued and retries it.
- **Call `identify` as early as you know the user.** The SDK invalidates and refetches the person
  and feature flags for you, so flags evaluated for the anonymous visitor never leak into the
  identified session.
