# Voidhash Android SDK

The bare Voidhash Android SDK plus the shared native core every Voidhash Android surface reuses.

Three Gradle modules live here, each with the Maven coordinate it is published under:

- **`sdk/`**, `com.voidhash:voidhash` (`com.voidhash.sdk`) — the public SDK: configuration,
  identity, products, purchases, transaction reporting, feature flags and analytics.
- **`core/`**, `com.voidhash:voidhash-core` (`com.voidhash.core`) — the shared engine the SDK and
  the React Native SDK depend on.
- **`ui/`**, `com.voidhash:voidhash-ui` (`com.voidhash.ui`) — the renderer that draws flows, with
  its native library; see [Flows](#flows).

The Gradle task `publishToMavenLocal` builds the three artifacts with their sources and javadoc
jars. They are signed only when a signing key is configured (`signingInMemoryKey`, or the `signing.*`
properties); Maven Central refuses unsigned ones. The version is this package's.

## Install

The SDK is on Maven Central. Resolve dependencies from it, as new Android projects do, and depend
on `com.voidhash:voidhash` in your app module; add `com.voidhash:voidhash-ui`, with the same
version, to present flows (see [Flows](#flows)):

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}
```

```kotlin
// app/build.gradle.kts
dependencies {
    implementation("com.voidhash:voidhash:0.1.2")
}
```

The three artifacts always share one version. The SDK is an alpha: a new version can change its
API, so read the changelog before updating. The `@voidhash/android` npm package, which earlier
releases offered as source, is deprecated: install from Maven Central instead.

To build from a checkout of this directory instead, include it with
`includeBuild("path/to/libraries/android")` and depend on the same coordinates without a version:
Gradle substitutes the included modules for them. Built this way, the `ui` module has no native
library and can't draw flows; use the Maven Central artifacts to present them.

Built from source, the modules compile against `compileSdk` 35 with `minSdk` 23 unless your build
sets the `Voidhash_compileSdkVersion` and `Voidhash_minSdkVersion` properties.

Requirements:

- Android Gradle Plugin 8.9.0, Kotlin 2.0.21, Java 8 bytecode target
- `minSdk` 23, `compileSdk` 35 (Play Billing 9 requires it of the app too)
- Built from source: the Android SDK resolved via `ANDROID_HOME` (or a local, uncommitted
  `local.properties`)
- Play Billing 9.1.0, Play Services Base, OkHttp 4.x and kotlinx-coroutines on the runtime
  classpath
- AndroidX Navigation is optional. The SDK ships the R8 rule that lets an app without it shrink;
  such an app only goes without the Navigation names under [Screen tracking](#screen-tracking)

The SDK contributes `android.permission.INTERNET` and `ACCESS_NETWORK_STATE` through its
manifest, and the core module contributes the background purchase check: the
`com.voidhash.core.billing.PlayFinishJobService` job service and `RECEIVE_BOOT_COMPLETED`, which
keeps that check scheduled across reboots (see [Products and purchases](#products-and-purchases)).
Only the billing permission has to be added to your app:

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
            publishableKey = "vh_pk_…",
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

Release builds use the production `vh_pk_…` key, including builds you test through Play testing
tracks: their purchases are store sandbox purchases, which unlock access by default. Debug builds in development mode, and internal builds that run against staging, use the test
`vh_pk_test_…` key. See
[API keys](https://voidhash.com/docs/concepts/api-keys).

`configure` is synchronous and cheap; `initialize()` loads local state and starts the Google Play
connection, schema refresh and unfinished-purchase reconciliation in the background. The client is also reachable
as `Voidhash.shared` afterwards. Until `initialize()` runs, the client does no work on its own:
returning to the foreground or regaining a network neither contacts Voidhash nor opens Google Play,
so you can defer `initialize()` until consent or sign-in.

The SDK runs in your app's main process only. `Application.onCreate` also runs in every other
process of your app, such as a service declared with its own `android:process` or a process that
another library starts. There `configure` returns an inert client, as with `enabled = false`: it
reads and writes nothing, makes no requests and never connects to Google Play, and it leaves
`Voidhash.shared` alone. The SDK's storage cannot be shared between processes. If your UI runs in
a named process on purpose, set `runInSecondaryProcess = true` and configure Voidhash in that one
process only.

If your app has a `directBootAware` component, Android can start its process after a reboot before
the device was unlocked for the first time. The app's storage is not available then, so the client
`configure` returns reads and writes nothing and makes no requests until the unlock, and what an
earlier launch stored and queued stays as it was. Until then:

- Captures and screens, `identify`, person attributes, `reset`, `setAnalyticsConsent` and
  `initialize()` are held in memory, in the order you made them. The newest 100 captures and
  screens are kept, each with the time it was made; dropping older ones is reported once as
  `ANALYTICS_EVENT_DROPPED`. Up to 100 `identify` and person attribute calls are kept, which report
  `WriteStatus.DEFERRED`.
- A purchase you report with `reportTransaction` or `syncStoreTransaction` is always held, however
  much else is, and the call throws `TRANSACTION_NOT_DURABLE`: nothing can be stored yet, so the
  report would not survive the process. Report it again after the unlock before you consume the
  purchase.
- Reads answer without a value, flagged stale and expired, and feature flags answer with their
  defaults. `getDistinctId()` answers with an id the SDK made up for the time being and never
  stores: the one stored on the device cannot be read yet, and takes its place at the unlock. Do
  not keep or send it. `sessionId` is empty until then.
- Everything else that cannot be done yet throws `DEVICE_LOCKED`: `purchase`, `restorePurchases`,
  `syncPurchases`, the stateless calls that take a distinct id, and an `identify` or person
  attribute call past the 100 held. `presentFlow` throws `FlowFailure.UNAVAILABLE`.

Once the device is unlocked the SDK configures itself again with the same key and options, in the
observer mode you last set with `setReadOnly`, and makes the held calls in order: the consent and
identity stored on the device decide what is collected, as on any other launch. The client
`configure` returned before the unlock then answers every call through the working client, which
`Voidhash.shared` returns too, so keep using whichever reference you have. A call you make on
either while the held ones are still being made takes its place after them, and `initialize()`
returns once the working client is initialized. The `DEVICE_UNLOCKED` diagnostic tells you when the
SDK took over. If you call `configure` yourself after the unlock, your client takes over instead and
gets what was held; `shutdown()` on the reference from before the unlock then leaves your client
running, as on any client a later `configure` replaced. If Android does not let the SDK watch for the unlock, it
reports `DEVICE_UNLOCK_NOT_OBSERVED` and takes over when one of your activities next starts on the
unlocked device; calling `Voidhash.configure` again after the unlock does the same.

Calling `configure` again replaces the client. The previous one stops its timers, callbacks and
Google Play connection, and anything it had queued is picked up by the new one, including a
previous client still in the final flush of `shutdown()`. A receipt reported to the previous client
afterwards is handed to the new one when both use the same publishable key and base URL. Under a
different key or base URL it is stored for that key and delivered once a client is configured with
it again. The previous client's methods that change the identity, the person or the store throw
`VoidhashException` with the code `CLIENT_SHUT_DOWN`.

`initialize()` never fails because Voidhash is unreachable, slow, returning 5xx, or hidden
behind a proxy or captive portal that answers in its place. It resolves as soon as local state
has loaded and keeps trying for the schema in the background for as long as the app runs, so a
cold, offline start still gives you a working client and you never have to call it again. The `try`/`catch` above is there for programmer errors only
— a coroutine launched from `onCreate` that throws would otherwise take the process down.

## Offline behaviour

Requests for selected flags reuse the same identity's cached full evaluation when no exact
evaluation is cached, including stale values offline. A subset never substitutes for a full evaluation.

Initialization and cached reads tolerate an unreachable backend. Entitlements, flags and paywalls
use the last known state while analytics and supported writes wait for delivery. Without cached
data, reads return their documented empty or unavailable results; purchases still require a usable
store connection. Offline state is not guaranteed to reflect the latest server state. Queue capacity,
invalid events and storage failures still impose durability limits.

What _can_ still throw is a definite answer from the Voidhash API itself, or a programmer error.
An `identify` the API refuses throws a `VoidhashApiException`, `400` (`Api/SdkValidationError`)
or `404` (`Api/SdkPersonNotFoundError`), and puts the previous identity back. Branch on `code` and
`tag` rather than on the status. A `409` (`Api/SdkPersonAlreadyIdentifiedError`) does not throw:
the anonymous id already belongs to another identified user, so the device switches to the new user
without that id's history and purchases, and reports `PERSON_WRITE_REJECTED`. Programmer errors
include a distinct id the API refuses or a nested trait value (`INVALID_ARGUMENT`), starting a
purchase before the SDK knows about any products, and a base URL no request can be built for
(`INVALID_REQUEST`). None of these are transport problems, and none has a sensible fallback.

The SDK treats a response as a verdict only when it is one of the API's own errors, which
carry a `_tag` in their JSON body. Everything else is transient: the data is kept and retried
with backoff, and the failure counts towards the circuit breaker. That covers network, DNS,
TLS and timeout failures, `408`, `425`, `429` and every `5xx` (including CDN statuses such as
`520`–`530`), any `3xx` or `4xx` without a Voidhash error body (an edge, firewall or proxy page,
a `401` or `403` included), and a `2xx` whose body is not the answer its endpoint gives, such as
a captive-portal page, an empty body or `{}`. A `429` also pauses requests to the part of the API
it came from, for the `Retry-After` it carries or five seconds without one: reads answer from the
cache and queued data waits, as while the circuit breaker is open. A `Retry-After` in seconds, as
an HTTP date, or as `retry_after_ms` in the body is honoured between one second and 30 seconds.
Every API request is bounded at 10 seconds, a flow package or image download at 20 seconds, and
the time `presentFlow` waits before a flow is ready to show at 15 seconds.

- **Reads are cache-first.** `getCurrentPerson`, `getFeatureFlags` and `resolvePaywall` answer from
  the last known state immediately and refresh behind the read. A read that finds a stale value
  waits at most 500 ms for the refresh before serving what it has. Only with nothing cached does a
  read wait for the network: a flag read at most `featureFlags.maxWaitMs` (2 s), a person or
  paywall read at most 10 s. It then answers without a value, flagged `isExpired`, and the request
  carries on; its answer is cached, and flags are published through `featureFlags`. When the
  circuit breaker or a rejected key answered a read from the cache, the person and the full flag
  evaluation are refreshed once requests get through again; a read of selected flags or of a
  paywall refreshes on its next call. When the API confirms it has
  no person for the current id, that answer is cached like a snapshot, so repeated checks for an
  anonymous visitor do not each wait on the network. Only that confirmation clears a cached
  person; a failed or unreadable refresh keeps serving the last snapshot, flagged stale.
- **Cached values are never discarded for being old.** An expired entry is still served, flagged
  `isExpired`. Use the `…State()` variants when you need to know: `getCurrentPersonState()`,
  `getFeatureFlagsState()`, `resolvePaywallState()`.
- **Queued data is never dropped for transport.** Analytics events, store receipts and person
  writes are written to disk and retried indefinitely with backoff. Only the analytics queue cap
  (1000 events, oldest first) or a verdict from the API drops anything, and both emit a
  diagnostic. A retry scheduled while the device clock ran ahead is not held back once the clock
  is corrected.
- **Retries run on their own while the app is in the foreground.** A timer checks every five
  seconds for queued work whose backoff has elapsed, so a receipt that failed during a short
  outage is delivered once Voidhash recovers, with no foreground, reconnect or `flush()` needed.
  Returning to the foreground, regaining a network, `flush()` and any request that succeeds also
  retry what is due, and going to the background sends person writes, receipts and events once.
  In the background the timer and the schema retries stop. Only a purchase the SDK has not
  finished wakes the app, through the background purchase check under
  [Products and purchases](#products-and-purchases).
- **Calls you await are bounded.** `flush()` and `shutdown()` return after at most 2 s, and the
  direct send of `identify` and `setPersonAttributes` waits at most 2 s before reporting
  `WriteStatus.DEFERRED`; the delivery carries on in the background. `purchase(...)` returns at most
  10 s after Google Play charged the user — the limit of the request that sends the receipt —
  whether or not Voidhash has accepted the receipt and the person was refreshed by then; what is
  left carries on in the background, the cached person is marked stale, and the receipt stays
  queued until it is accepted. It does not wait for Google Play to acknowledge or consume the
  purchase, which starts once Voidhash accepted the receipt. After such an early return, read the
  person again (`getCurrentPerson`) before you decide on access. `restorePurchases()` and
  `syncPurchases()` wait the same 10 s for Voidhash once Google Play has listed the purchases. Writes for a person are sent one at a time, in the order
  they were made, and a refusal that arrives after the call returned `DEFERRED` drops the write with
  `PERSON_WRITE_REJECTED`, as for any queued write.
- **Recovery is spread out.** The circuit breaker opens after five consecutive failures for 30 s
  plus up to 25 % at random, doubling up to five minutes, and requests that fail while the device
  has no network do not count. After an outage one flush sends at most ten batches of events; the
  timer sends the rest five seconds apart.
- **Receipts survive process death.** A store receipt reaches disk before the sync request goes
  out and is removed only once the backend accepts it.
- **One failing receipt does not hold back the others.** Queued receipts are sent the ones that
  failed least often first, so while the circuit lets a single request through, a new purchase
  goes before a receipt the backend keeps failing.
- **Writes are applied locally and queued.** `identify`, `setPersonAttributes` and
  `syncStoreTransaction` never fail for transport, an unreadable answer or a rejected key. They
  take effect on the device immediately and report `WriteStatus.DEFERRED`; the SDK delivers them
  when the backend is reachable again. Use the `…WithStatus` variants when you want to know which
  happened. Traits for a user wait for that user's queued `identify`, and queued person writes
  are delivered before queued receipts, so a receipt made anonymously lands on the merged person.
  An anonymous purchaser who signs in while Voidhash is unreachable keeps the entitlements cached
  for the anonymous id, flagged stale, until the backend confirms the alias. The visitor's flags
  answer for the user the same way until the user's own evaluation arrives; a sign-out or a switch
  between users drops them.
- **The SDK refreshes itself.** Boot, app foreground, connectivity restored, `identify`/`reset`,
  and TTL expiry all trigger a refresh. You never have to call one. The schema retries for
  as long as the app runs, so a device that starts offline still ends up configured without
  the host calling `initialize()` again, and a schema older than a day is refreshed on the next
  foreground or reconnect.
- **Storage stays off your thread.** `configure`, `capture` and the suspending calls never read
  or write a file on the thread that called them: persistence runs on the SDK's own writer
  thread, and the HTTP client is built on the first request. The SDK saves synchronously on that
  thread, so an activity stop never waits for an SDK write. The exceptions are `getDistinctId()`
  and `sessionId`: read before `initialize()`, they may wait briefly for the SDK's stored state to
  load, unless you pinned the `distinctId` option.
- **A store surface with no schema degrades rather than throws.** `getProducts()` returns an
  empty list and `restorePurchases()` still reconciles the store.

```kotlin
when (voidhash.identifyWithStatus("user-123", email = "a@b.co").status) {
    WriteStatus.CONFIRMED -> Unit // the backend has it
    WriteStatus.DEFERRED -> Unit  // applied locally, queued for delivery
    WriteStatus.SKIPPED -> Unit   // only an ad data sharing agreement, without consent
}
```

```kotlin
val person = voidhash.getCurrentPersonState()
if (person.isExpired) {
    // Older than its two-day lifetime. Still the best answer available, but decide for yourself
    // whether it may gate high-value content.
}
```

Diagnostics report anything the SDK handled on its own. The handler runs on a background thread
of the SDK's, one report at a time in the order they were made, never on the thread that caused
them; an exception it throws is ignored. At most 1000 reports wait for a handler that falls
behind; past that the oldest are dropped and the handler next receives `DIAGNOSTICS_DROPPED` with
their count.

```kotlin
VoidhashOptions(
    onDiagnostic = { diagnostic ->
        when (diagnostic.kind) {
            VoidhashDiagnosticKind.AUTH -> Log.e("Voidhash", diagnostic.message)
            else -> Log.d("Voidhash", "${diagnostic.code}: ${diagnostic.message}")
        }
    },
)
```

Match on `code`; the message is for people. Messages never contain a user id, an email or a
purchase token: a receipt or a person is named by a short stand-in such as `#1a2b3c4d`, the same
for every report about it.

| Code                                   | Kind        | Meaning                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTHENTICATION_FAILED`                | `AUTH`      | The API rejected the publishable key (a `401` or `403` with a Voidhash error body). Outbound traffic pauses and queued data is kept. Reported once per pause.                                                                                                                         |
| `AUTHENTICATION_RECOVERED`             | `AUTH`      | A probe was accepted, or the first request after `identify` or `reset` lifted a reported pause; outbound traffic resumed.                                                                                                                                                             |
| `CIRCUIT_OPEN`                         | `BREAKER`   | Requests to one part of the API failed transiently five times in a row, so they are skipped and the cache answers until a probe succeeds, about 30 s later (doubling up to five minutes). Once per outage.                                                                            |
| `CIRCUIT_CLOSED`                       | `BREAKER`   | A request succeeded again after `CIRCUIT_OPEN`.                                                                                                                                                                                                                                       |
| `TRANSACTION_SYNC_DEFERRED`            | `TRANSPORT` | A receipt is still queued after a sync attempt that failed or that the backend did not confirm. It is retried with backoff. Not reported for a receipt that was not sent because the circuit is open or the key is paused; that one is sent as soon as requests go out again.         |
| `PURCHASE_FINISHED_BEFORE_SYNC`        | `TRANSPORT` | A purchase the SDK started was still unrecorded by Voidhash 36 hours after payment, less for a short prepaid plan, so the background check acknowledged it on the device. Reported when the SDK is configured in that process and still holds the receipt, which it delivers.         |
| `TRANSACTION_REJECTED`                 | `TRANSPORT` | The backend refused a receipt with a verdict that will not change. It is kept and sent again on the next launch or after six hours. Once per receipt.                                                                                                                                 |
| `TRANSACTION_NOT_DURABLE`              | `CACHE`     | A reported receipt could not be written to storage, or was reported before the device was first unlocked; `reportTransaction` also throws.                                                                                                                                            |
| `TRANSACTION_OUTBOX_BACKLOG`           | `EVICTION`  | More than 1000 receipts are waiting for the backend. None was dropped.                                                                                                                                                                                                                |
| `PERSON_WRITE_REJECTED`                | `EVICTION`  | A queued `identify` or attribute write was dropped because the API refused it with a verdict, or an `identify` switched users without merging an anonymous id that already belongs to another user.                                                                                   |
| `ANALYTICS_SEND_FAILED`                | `TRANSPORT` | An analytics batch was not delivered and is retried with backoff.                                                                                                                                                                                                                     |
| `ANALYTICS_EVENT_DROPPED`              | `EVICTION`  | Events were evicted at the 1000-event cap, reported at most once a minute with the count since the last report and once more when delivery resumes or the client stops; or an event was refused by the ingest API. A refused batch is halved until only the refused event is dropped. |
| `ANALYTICS_EVENT_INVALID`              | `EVICTION`  | An event was not queued: its name was blank, or it had no distinct id.                                                                                                                                                                                                                |
| `ANALYTICS_CONSENT_DENIED`             | `CONSENT`   | A `capture`, `screen` or `trackPushOpened` call was not collected because analytics consent is not granted; events and screens the SDK records itself are skipped silently. Once until consent is granted again.                                                                      |
| `INSTALL_ATTRIBUTION_DEFERRED`         | `TRANSPORT` | Google Play or a Meta app could not answer about the install's referrer yet, or the touch could not be stored. A later launch asks again, up to 10 launches.                                                                                                                          |
| `INSTALL_ATTRIBUTION_ABANDONED`        | `TRANSPORT` | The SDK stopped asking about the install's referrer: the device has no Google Play, or 10 launches passed without an answer.                                                                                                                                                          |
| `SCREEN_MAPPER_FAILED`                 | `EVICTION`  | `ScreenTrackingOptions.mapScreen` threw, so that screen was not captured. The exception does not reach the activity, fragment or navigation callback that reported the screen.                                                                                                        |
| `SCHEMA_FETCH_FAILED`                  | `TRANSPORT` | The project schema could not be fetched; the SDK keeps retrying.                                                                                                                                                                                                                      |
| `SCHEMA_DECODE_FAILED`                 | `TRANSPORT` | The schema response could not be read; the SDK backs off and retries.                                                                                                                                                                                                                 |
| `CACHE_READ_FAILED`                    | `CACHE`     | An unreadable cache entry was discarded and treated as a miss.                                                                                                                                                                                                                        |
| `CACHE_WRITE_FAILED`                   | `CACHE`     | A write to device storage failed. The value stays in memory and is stored with the next write that succeeds.                                                                                                                                                                          |
| `QUEUE_IO_FAILED`                      | `CACHE`     | A queue file could not be read or written; the queue keeps working in memory. Once per run of failures.                                                                                                                                                                               |
| `INVALID_REQUEST`, `INVALID_PAYLOAD`   | `TRANSPORT` | A request could not be built: a bad base URL or header value, or a body that is not JSON. Once per code.                                                                                                                                                                              |
| `CONNECTIVITY_OBSERVATION_UNAVAILABLE` | `TRANSPORT` | The SDK cannot observe connectivity; queues are still retried on a timer and on foreground.                                                                                                                                                                                           |
| `SECONDARY_PROCESS_INERT`              | `CACHE`     | `configure` ran outside the app's main process, so the client is inert.                                                                                                                                                                                                               |
| `DEVICE_LOCKED_INERT`                  | `CACHE`     | `configure` ran before the device was first unlocked, so the client holds what it can and does nothing else until then; see [Configure](#configure).                                                                                                                                  |
| `DEVICE_UNLOCKED`                      | `CACHE`     | The device was unlocked and the SDK configured itself again after `DEVICE_LOCKED_INERT`; the client from before the unlock works from here on.                                                                                                                                        |
| `DEVICE_UNLOCK_NOT_OBSERVED`           | `CACHE`     | After `DEVICE_LOCKED_INERT`, Android did not let the SDK watch for the unlock. It takes over when an activity of the app next starts on the unlocked device, or when you call `Voidhash.configure` again.                                                                             |
| `INTERNAL_ERROR`                       | `TRANSPORT` | Work the SDK does on its own stopped on an exception it did not expect. The exception does not reach your app, and the SDK carries on.                                                                                                                                                |
| `DIAGNOSTICS_DROPPED`                  | `EVICTION`  | The `onDiagnostic` handler fell more than 1000 reports behind; the oldest were dropped. Carries their count.                                                                                                                                                                          |

Some codes differ from the web SDK's for the same situation. Route on these names:

| Android                                                                     | Web SDK                                    |
| --------------------------------------------------------------------------- | ------------------------------------------ |
| `CIRCUIT_OPEN` (when the circuit opens)                                     | `CIRCUIT_OPENED`                           |
| none (skipped requests are not reported one by one)                         | `CIRCUIT_OPEN` (the first request skipped) |
| `ANALYTICS_SEND_FAILED`, `TRANSACTION_SYNC_DEFERRED`, `SCHEMA_FETCH_FAILED` | `TRANSPORT_FAILED`                         |
| `PERSON_WRITE_REJECTED`                                                     | `IDENTITY_WRITE_REFUSED`                   |

A publishable key the API rejects pauses outbound traffic, keeps every queue on disk, and reports
once through `onDiagnostic` with `kind = AUTH`. Only the API's own answer counts: a `401` or `403`
carrying a Voidhash error body. One without it comes from something in front of the API, such as
a firewall or a proxy, and is retried like any other outage without pausing anything else. The
pause lasts until a probe is accepted, or until `identify`, `reset` or a new `configure` tries the
key again. The SDK probes at most once a minute: from the retry timer while the app is in the
foreground, and on foreground, reconnect and `flush()`. A probe is accepted when the API itself
answers it with anything but a rejected key: a `2xx` whose body is a JSON object, or one of its
own errors. Any other answer leaves the pause to the next probe, including a `2xx` from something
in front of the API, such as a proxy's or a maintenance page, or one with an empty body. Once a
probe is accepted the SDK delivers everything that queued up. Writes made during the pause, including the
one that ran into it, report `WriteStatus.DEFERRED` instead of throwing.

`VoidhashOptions`:

| Option                   | Default                    | Meaning                                                                                               |
| ------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `baseUrl`                | `https://api.voidhash.com` | Voidhash API origin                                                                                   |
| `ingestUrl`              | `baseUrl`                  | Analytics ingest origin                                                                               |
| `debug`                  | `false`                    | Reports the build as a debug build and writes SDK warnings to logcat; off, nothing is logged          |
| `distinctId`             | `null`                     | Pins the initial distinct id instead of generating an anonymous one; see [Identity](#identity)        |
| `enabled`                | `true`                     | When false the client is inert; see [Disabled clients](#disabled-clients)                             |
| `readOnly`               | `false`                    | Observer mode: syncs transactions but never finishes them with the store, and refuses purchases       |
| `dev`                    | `false`                    | Requests development mode (debug builds only); see [Development mode](#development-mode)              |
| `preloadLocations`       | `emptyList()`              | Locations whose flows are fetched and cached on the first launch; inert without a renderer            |
| `flowRevisions`          | `emptyMap()`               | The interface revision the app was built against, per location; see [Flows](#flows)                   |
| `flowRenderer`           | `null`                     | Draws flows instead of the linked `voidhash-ui` renderer; see [Flows](#flows)                         |
| `flowCapabilities`       | `setOf(LINKS)`             | What flows may do besides purchasing and restoring; see [Flows](#flows)                               |
| `onDiagnostic`           | `null`                     | Receives reports about situations the SDK handled itself, on a background thread, in order            |
| `runInSecondaryProcess`  | `false`                    | Runs the SDK in a process other than the main one; see [Configure](#configure)                        |
| `analyticsConsent`       | `AnalyticsConsent.GRANTED` | Consent until the app calls `setAnalyticsConsent`; see [Analytics consent](#analytics-consent)        |
| `analyticsWhilePending`  | `PendingAnalytics.DROP`    | `BUFFER` holds events in memory while consent is pending; see [Analytics consent](#analytics-consent) |
| `grantConsentOnIdentify` | `false`                    | `identify` grants a pending consent; see [Analytics consent](#analytics-consent)                      |
| `installAttribution`     | `true`                     | Credits new installs to the ad behind them; see [Install attribution](#install-attribution)           |
| `metaAppId`              | `null`                     | Also asks Meta's apps about the install; see [Install attribution](#install-attribution)              |
| `featureFlags`           | `FeatureFlagOptions()`     | `maxWaitMs` (2 s) bounds a flag read with nothing cached; `defaults` answer for unevaluated flags     |

### Development mode

Set `VoidhashOptions(dev = true)` to test purchases on any emulator or device without store
credentials. It is honored **only in debug builds** (`FLAG_DEBUGGABLE`); release builds always use
real Google Play Billing.

In development mode `purchase(...)` runs against a mock store: products are synthesized from the
schema's development metadata, a "Test purchase" confirmation sheet replaces the Play Billing flow,
and the recorded purchase is a test purchase, so it never unlocks access in production. Configure
the project's test publishable key (`vh_pk_test_…`) in debug builds: Voidhash refuses simulated
purchases made with the production key, and only a test key reads them. Simulated purchases go
through `purchase(...)`, so they are refused in observer mode like any other.

### Storage and backups

The SDK keeps its state in the `com.voidhash.sdk.cache` shared preferences file and in
`files/voidhash/` (queued events, receipts and person writes). Android Auto Backup includes both by
default, so a reinstall or a new device restored from a backup continues the backed-up anonymous
identity, and receipts still queued in the backup are delivered. The SDK tells a restored install
apart by the app's install time: it captures `$app_installed` and starts a new session rather
than continuing the backed-up one.

To keep the identity out of backups, exclude the preferences file. A restored app then starts
with a new anonymous identity, and an anonymous purchaser needs `restorePurchases()` to regain
access. Leave `files/voidhash/` included: a queued receipt restored with it is still delivered.

```xml
<!-- res/xml/data_extraction_rules.xml, android:dataExtractionRules (Android 12 and later) -->
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="sharedpref" path="com.voidhash.sdk.cache.xml" />
    </cloud-backup>
    <device-transfer>
        <exclude domain="sharedpref" path="com.voidhash.sdk.cache.xml" />
    </device-transfer>
</data-extraction-rules>
```

```xml
<!-- res/xml/backup_rules.xml, android:fullBackupContent (Android 11 and earlier) -->
<full-backup-content>
    <exclude domain="sharedpref" path="com.voidhash.sdk.cache.xml" />
</full-backup-content>
```

The state is namespaced by publishable key and API origin. The origin is compared without trailing
slashes and without regard to the case of its scheme and host, so once a device runs this release,
changing how `baseUrl` is spelled does not reset it. State an earlier release stored under a
`baseUrl` spelled otherwise, such as with a trailing slash, moves over on the first launch with the
same `baseUrl`.

### Disabled clients

With `enabled = false` the client is inert, and so is one configured without a publishable key:
`Voidhash.configure(context, null)`, or a blank key. A build or an environment that has no key can
configure and call the SDK like any other. An inert client makes no requests, never connects to Google Play,
runs no timers or activity callbacks, and reads and writes no storage, so whatever an enabled
client stored earlier (the identity, queued events and receipts) is kept untouched for the next
enabled launch. Every method returns its empty value: `getProducts()` and `getFeatureFlags()` an
empty list, `getCurrentPerson()` and `resolvePaywall()` `null`; `identify()`,
`setPersonAttributesWithStatus()` and `setAdDataSharing()` no person with `WriteStatus.DEFERRED`,
since nothing is written; `sessionId` is empty; `syncStoreTransaction()` `false`, `flush()` and `shutdown()` an empty
`FlushStatus`; `capture`, `screen`, `reportTransaction`, `syncPurchases` and
`reset`, `signOut`, `group` and `setGroups` do nothing, and `restorePurchases()` returns `null`.
`presentFlow()` throws a `FlowException` with `FlowFailure.DISABLED`. `purchase()` returns
`VoidhashPurchaseResult.Disabled`, `getStorefront()` `null`, `canMakePayments()` `false`, and the
`googlePlay` calls their empty values. `getDistinctId()` returns the
`distinctId` option, or an anonymous id that is not stored.

## API

Every method on `VoidhashClient` other than `capture`, `screen`, `isFeatureEnabled`,
`getDistinctId`, `setReadOnly`, `setAnalyticsConsent` and `dismissFlow` is a suspending function.

### Products and purchases

```kotlin
val (yearly, monthly) = voidhash.getProducts(listOf("pro-yearly", "pro-monthly"))
when (val result = voidhash.purchase(activity, yearly!!)) {
    is VoidhashPurchaseResult.Purchased -> showThanks() // result.synced: whether Voidhash has it yet
    VoidhashPurchaseResult.Pending -> showPaymentPending() // completes later, see transactionUpdates
    VoidhashPurchaseResult.Cancelled -> Unit // the user closed the sheet
    VoidhashPurchaseResult.Disabled -> Unit // configured with enabled = false
}
// Queries currently owned Play purchases, submits them, and returns the refreshed person.
val person = voidhash.restorePurchases()
```

Grant access from the person's entitlements, never from a product, a transaction or a
subscription list.

#### Products

`getProducts()` returns every product of the project that Google Play sells, sorted by slug;
`getProducts(slugs)` returns the products of those slugs in the order given, with `null` for one that
cannot be loaded. A product that cannot be loaded — not returned by Google Play (Play's own reason,
such as an inactive product or no offer the user is eligible for), or whose pinned base plan Play did
not return, and with `getProducts(slugs)` also one not in the schema or not configured for Google
Play — is left out and reported once per call through `onDiagnostic` as `PRODUCT_NOT_FOUND`, with
the reason in the message. One Google Play sells as the other type than Studio's (a subscription
for a one-time product, or the reverse) is reported as `PRODUCT_TYPE_MISMATCH`, naming both types.
`getProducts()` leaves products Studio does not sell on Google Play out without a report, as the iOS
SDK does. Each Studio
product is one `VoidhashProduct`, so two products that are base plans of the same Play subscription
are two products with the same `storeProductId`.

| Property                     | What it is                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `productId`, `slug`, `name`  | The product's Voidhash id (as a person's subscriptions name it), its slug and its name in Studio.                                                  |
| `storeProductId`             | The Play product id.                                                                                                                               |
| `type`                       | `SUBSCRIPTION`, `CONSUMABLE` or `NON_CONSUMABLE`, from the product's type in Studio.                                                               |
| `displayName`, `description` | Google Play's localized name and description.                                                                                                      |
| `price`                      | The regular price: `amount` (a `BigDecimal`), `amountMicros`, `currencyCode` and Play's own `formatted` text. For a subscription, its base plan's. |
| `subscription`               | For a subscription: `period`, `groupId`, `introOffer` and the regular price spread per day, week, month and year.                                  |
| `offers`                     | The other offers the user can buy it with.                                                                                                         |
| `googlePlay`                 | Everything Google Play returned, its `ProductDetails` included.                                                                                    |

A subscription is the base plan Studio pins (Play's first base plan when it pins none). Its price
and `period` are the base plan's last pricing phase, its regular price; a prepaid plan's
non-recurring phase too. `period` is a `VoidhashPeriod` (`unit`, `count`, `iso8601`), normalised so
that `P7D` is one week. `pricePerDay`, `pricePerWeek`, `pricePerMonth` and `pricePerYear` take a day
as a 365th, a week as a 52nd and a month as a 12th of a year, round half up to the currency's minor
units, and are formatted for the device's locale: a yearly 49.99 USD is 4.17 per month, 0.96 per
week and 0.14 per day.

#### Offers

An offer is a `VoidhashOffer`: its `id` (Studio's id for an offer Studio configures, otherwise
Google Play's offer id), its `kind` and, for a subscription offer, the `phases` ahead of the regular
price, each with a `paymentMode` (`FREE_TRIAL`, `PAY_AS_YOU_GO`, `PAY_UP_FRONT`), `price`, `period`
and number of `cycles`.

Google Play returns an offer for new customers only to users eligible for it, but returns an offer
it leaves to the developer to target to every user, without saying which is which. So, among the
offers on the product's base plan:

- `subscription.introOffer` is the offer tagged `voidhash-intro` in the Play Console, or else the
  offer with the longest free trial that Studio does not name and that is not tagged
  `voidhash-ignore`. An offer that starts with a paid discount is never chosen on its own: it may
  be meant for lapsed or upgrading subscribers only. Tag it `voidhash-intro` to make it the
  introductory offer.
- `offers` are the offers Studio configures (by Studio's id), then every other offer Play returned
  that is not tagged `voidhash-ignore`. Tag an offer meant for some users only `voidhash-ignore`,
  or buy it only by its id.
- A one-time product is priced by its first purchase option; its discounted offers on that option
  are its offers, of kind `ONE_TIME`.

> **Tag your developer-determined trials.** Google Play returns developer-determined offers to
> every user: an untagged developer-determined free trial becomes `introOffer` and is applied to
> every purchase by default, also for users who had a trial before. Tag such offers
> `voidhash-ignore`, or tag the trial you intend `voidhash-intro`. A plan change (`replacing`)
> applies `introOffer` by default only when it is tagged `voidhash-intro`.

#### Buying

`purchase(activity, product, options)` launches the Play Billing flow from `activity`, syncs the
resulting transaction to Voidhash and then acknowledges it, or consumes it for
`one-time-consumable` products. On success it refreshes the person.

By default a subscription is bought with its `introOffer` when the user can get one, and at its
regular price otherwise. `VoidhashPurchaseOptions` changes that:

| Option                             | Effect                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `offer = VoidhashOfferSelection.…` | `Automatic` (the default), `None` (the regular price), `Offer(offer)` or `Id("win-back")`, among `offers` and `introOffer`.     |
| `replacing`                        | The subscription the purchase replaces; see [Changing a subscription](#changing-a-subscription).                                |
| `googlePlay.offerToken`            | Buys exactly this base plan, offer or purchase option from `product.googlePlay`, whatever `offer` says.                         |
| `googlePlay.obfuscatedProfileId`   | Play's profile id for the purchase. The account id is the SDK's own.                                                            |
| `googlePlay.isOfferPersonalized`   | Tells Google Play the price was personalised, which it then discloses, as EU law requires.                                      |
| `quantity`                         | Must be 1: Google Play has the user choose the quantity in its own sheet. The transaction's `quantity` is what the user bought. |

An offer the product does not have, or Google Play does not offer this user, fails with
`OFFER_UNAVAILABLE`; any other quantity fails with `INVALID_ARGUMENT`. The product is never bought at
its regular price instead. Eligibility for an introductory offer belongs to the Google account, not
to your user: when Google Play refuses an offer the account is not eligible for, `purchase` throws a
`VoidhashPurchaseException` whose `reason` is `PurchaseFailureReason.INELIGIBLE_FOR_OFFER`, and a
payment declined for insufficient funds has the reason `PAYMENT_DECLINED`. Load the products again
before offering another purchase.

`purchase` returns a `VoidhashPurchaseResult`:

- `Purchased(transaction, synced)`: Google Play charged the user. `synced` is whether Voidhash
  accepted the receipt before `purchase` returned.
- `Pending`: Google Play waits for the payment, such as one in cash. Nothing is granted yet; when it
  is made, the purchase arrives through `transactionUpdates` and the person, also after a relaunch.
- `Cancelled`: the user closed the sheet.
- `Disabled`: the client was configured with `enabled = false`.

A second `purchase` while one runs, also one from a flow, fails with `PURCHASE_IN_PROGRESS`.

The receipt reaches disk before the sync request goes out. When Voidhash cannot be reached, or has
not answered within 10 s, `purchase` still returns `Purchased` with `synced = false` and the receipt
stays queued. The SDK delivers it while the app runs — on the retry timer in the foreground, once
when the app goes to the background, at the next launch, and from the background purchase check
described below — and acknowledges or consumes the purchase once Voidhash accepts it.

#### Transactions

A `VoidhashTransaction` is a purchase as Google Play reported it: `id` (the purchase token, the same
while pending and once paid), `productSlug`, `storeProductId`, `purchasedAt` (epoch milliseconds),
`quantity`, the `offer` a `purchase` applied, and `googlePlay` with Play's own fields (`orderId`,
`purchaseToken`, `productIds`, `purchaseState`, `isAcknowledged`, `isAutoRenewing`,
`obfuscatedAccountId`, `obfuscatedProfileId`, `isSuspended`). `expiresAt`, `isRenewal` and
`environment` are not known on the device for a Google Play purchase (`null` and `UNKNOWN`); the
person's subscriptions carry them. When several Studio products are base plans of the same Play
subscription, a transaction the device did not start has no `productSlug`: Google Play does not say
which base plan it bills on the device.

#### Updates

`person` is a `StateFlow<VoidhashPerson?>` of the current identity's person, updated whenever a
snapshot is cached — after a purchase, a restore, an identify, a refresh — and when the identity
changes. `transactionUpdates` is a `SharedFlow<VoidhashTransactionUpdate>` of purchases that
complete outside `purchase`: a payment that was pending, a code redeemed in the Play Store, a
purchase whose `purchase` call went away while the sheet was open. Each carries the `transaction`
and `synced`.

```kotlin
lifecycleScope.launch { voidhash.person.collect { render(it) } }
lifecycleScope.launch { voidhash.transactionUpdates.collect { update -> showThanks(update.transaction) } }
```

A transaction update is emitted once the SDK has handled the purchase — Voidhash accepted its
receipt (`synced` is `true`), or the receipt is queued on the device (`false`) — and at most once
per transaction in a process. It
is a signal for UI, not a delivery guarantee: an update emitted while nothing collects is not
replayed, and access always comes from the person's entitlements. Google Play renews a subscription
under the purchase it already has, so renewals are not emitted on Android; the person shows them.

Once Google Play has charged the user and Voidhash has accepted the receipt, `purchase` returns
`Purchased` as soon as the person is refreshed, and acknowledges or consumes the purchase with
Google Play without waiting for it. If that fails, for example because the connection to Play
dropped, the SDK finishes the purchase on its next scan of the store without sending the receipt
again.

Other Play failures throw one of these codes:

| Code                 | Meaning                                                                                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ITEM_ALREADY_OWNED` | The user already owns the product, so it cannot be bought again. Offer to restore instead. The SDK scans the store in the background and delivers and finishes what it owns of the product, so a consumable can be bought again after. |
| `STORE_UNAVAILABLE`  | Google Play could not be reached or cannot bill right now: its service is disconnected or unavailable, billing is unavailable on the device, or the network failed. Trying again later may work.                                       |
| `SKU_NOT_FOUND`      | Google Play does not offer the product to this user, or `getProducts()` has not loaded it yet.                                                                                                                                         |
| `BILLING_ERROR`      | Any other failure Google Play reported; a `VoidhashPurchaseException` with a `reason` when Play gave one.                                                                                                                              |

When Google Play reported the failure, the exception's `cause` is a `BillingEngineException` whose
`responseCode` is Google Play's own response code. After `STORE_UNAVAILABLE` the SDK cannot always
tell whether the user completed the purchase before Play went away. If they did, the SDK finds the
purchase on its next scan and syncs and finishes it like any other purchase it started.

The Play Billing sheet is always opened on the main thread, so `purchase` can be called from any
coroutine dispatcher.

Owner mode, where the SDK finishes purchases, is the default. Initialization installs the Play
purchase observer and reconciles existing transactions; in owner mode the SDK also finishes the
subscriptions and non-consumables it finds unacknowledged, and the consumables it bought itself. It
leaves other consumables alone, since another billing integration may still have to consume them:
in owner mode it neither reports nor consumes them, whether a scan finds them or Google Play
announces them while the app runs. Report those with `reportTransaction`. Until the project's
product configuration has loaded for the first time, the SDK cannot tell a consumable from any
other product, so in owner mode it leaves every purchase it did not start alone until it has, and
then scans the store again.

The SDK recognises a purchase it started by the account identifier it gives Google Play for the
buyer, so it still knows its own purchase when the app was closed while the Play sheet or a payment
app was in front, however long the sheet stayed open and whatever the device clock says.

Google Play refunds a purchase left unacknowledged for three days. The servers acknowledge a
purchase the SDK started itself in owner mode once they record it, in case the app stops before the
SDK finishes it; they never acknowledge or consume a purchase the SDK did not start. For a purchase
Voidhash has not recorded, the SDK keeps its own deadline:

- A purchase the SDK starts in owner mode is recorded on the device as soon as Google Play reports
  it, a pending one too, until it is acknowledged or consumed. If the app was closed before Google
  Play reported it, the next scan of the store records it, and its deadline counts from the time
  Google Play gives for the purchase, but ends no sooner than four hours after that scan — an
  eighth of Google Play's window for a short prepaid plan: for a payment that stayed pending, that
  time is well before the payment. Purchases in observer mode and purchases your app reports
  with `reportTransaction` are never recorded.
- While such a purchase is unfinished, a background job checks it every four hours once the device
  has a network, even when the app is closed. If your app configures Voidhash in
  `Application.onCreate`, the job first lets the SDK deliver its queued receipts, for up to 30 s.
  It works with the client configured last in the process.
- A purchase Google Play still lists as unacknowledged 36 hours after its payment went through is
  then acknowledged on the device. That is half of Google Play's three days on purpose: Android
  may put off the job of an app the user has not opened for a while by about a day. Google Play
  gives a prepaid plan shorter than a week only half its duration, so such a purchase is
  acknowledged halfway through that: six hours after the payment for a one-day plan. A purchase
  the next scan finds instead of its buy, whose base plan Google Play does not say, gets the
  deadline of its product's shortest prepaid plan. For a pending payment the SDK cannot tell exactly when it
  completed, so the deadline starts no later than the last check that still saw it pending, or the
  moment Google Play reports it paid while the app runs. Google Play lists only the purchases of
  the account signed in now, so a paid purchase missing from its list is kept until its record
  expires, in case the user switched accounts for a while. The job only acknowledges, a `one-time-consumable` product too, so the purchase stays in Google
  Play's list: the SDK finds it there on its next scan, sends it to Voidhash, and consumes it once
  Voidhash has recorded it. Until then the consumable cannot be bought again.
- If the SDK still holds the purchase's receipt, it reports `PURCHASE_FINISHED_BEFORE_SYNC` and
  delivers the receipt once Voidhash is reachable. A purchase that was still pending when
  `purchase` returned `Pending` has no receipt queued yet; the next scan picks it up.
- A record is dropped four days after the payment was first seen, when Google Play's window has
  certainly closed, or after
  30 days for a payment that never completed.

The trade-off: Google Play's automatic refund no longer catches a purchase Voidhash never records,
for example one the backend refuses for good. Such a purchase stays paid without granting access
until you resolve it, which `TRANSACTION_REJECTED` reports. For a consumable it also stays owned: a
consumable acknowledged on the device whose receipt never reaches Voidhash — refused for good, the
app uninstalled or its data cleared, or no scan finding it within the 30 days the SDK remembers
its own purchases — cannot be bought again by that user. Refunding the order from the Play Console
releases it.

The job runs from `com.voidhash.core.billing.PlayFinishJobService`, which the SDK's manifest
declares with `RECEIVE_BOOT_COMPLETED`, so the check survives a reboot. An app that removes that
permission still gets the check: it is scheduled again whenever the SDK connects to Google Play.
From Android 14 it uses its own JobScheduler namespace; below that it uses the job id `0x76687066`
and leaves a job of yours with that id alone.

#### Changing a subscription

On Google Play, buying another subscription product does not end the one the user already has:
they hold both, and Google Play bills both. To move a subscriber to another product, an upgrade, a
downgrade or another plan, name the subscription the purchase replaces:

```kotlin
voidhash.purchase(
    activity,
    yearly,
    VoidhashPurchaseOptions(replacing = SubscriptionReplacement(monthly, SubscriptionReplacementMode.WITH_TIME_PRORATION)),
)
```

`monthly` and `yearly` are products from `getProducts()`, also two base plans of the same Play
subscription, which Google Play switches only with some modes (see below). The SDK asks Google
Play for the user's
current purchase of the replaced product, so you handle no purchase tokens, and Google Play ends
that subscription when the new one starts. The new purchase is synced, acknowledged and recorded
like any other purchase the SDK starts; once Voidhash has it, the replaced subscription no longer
grants access. A subscription bought before the person signed in can be
changed like any other: the new purchase belongs to the person who makes it. If the app is closed
while the Play sheet is open, the SDK still recognises the new purchase as its own on its next
scan, also when the replaced subscription was not bought through the SDK: it then goes by Google
Play no longer listing the replaced purchase.

| Mode                    | What Google Play charges                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WITH_TIME_PRORATION`   | Nothing now. The time left on the old subscription is converted into time on the new one, which moves the next billing date. The default, as on Google Play. |
| `CHARGE_PRORATED_PRICE` | The price difference for the rest of the period, now; the billing date stays. Google Play accepts it only for an upgrade.                                    |
| `CHARGE_FULL_PRICE`     | The full price of the new subscription, now; what was left of the old one is credited to it.                                                                 |
| `WITHOUT_PRORATION`     | The new price, first on the next billing date, which stays.                                                                                                  |
| `DEFERRED`              | Nothing now. The user keeps the old subscription until it renews, and the new one starts then. Suits downgrades.                                             |

Every other mode changes the subscription at once. With `DEFERRED`, Google Play gives the new
purchase its own token but reports it with the old product until the change takes effect, so the
returned transaction names the old product; the person's subscription shows the coming change as
`renewsToProductSlug`. The SDK uses Play Billing 9's per-product replacement parameters
(`SubscriptionProductReplacementParams`) with their own mode constants.

Google Play accepts fewer modes for some plans, and the SDK refuses the others with
`INVALID_ARGUMENT` before its sheet opens, where Google Play would show the user an error:

- Replacing any subscription with a prepaid plan: `CHARGE_FULL_PRICE` only.
- Switching to an auto-renewing base plan of the same Play subscription, from a prepaid or an
  auto-renewing one: `CHARGE_FULL_PRICE` or `WITHOUT_PRORATION` only.

Nothing is bought when the replacement cannot be made. `purchase` throws
`REPLACED_SUBSCRIPTION_NOT_OWNED` when the signed-in Google Play account has no paid purchase of
the replaced product, `INVALID_ARGUMENT` when either product is not a subscription, both are
the same product, or the mode is one Google Play does not accept for the plans, and
`SUBSCRIPTION_REPLACEMENT_REFUSED`, with Google Play's reason in the message, when Google Play rejects the replacement itself before its sheet opens. A purchase started from a flow cannot name a replaced subscription yet; start
such a purchase with `purchase(...)`. Development mode simulates the purchase and replaces nothing.

Only Google Play needs this. On iOS the App Store moves a subscriber between the products of one
subscription group by itself.

#### Observer mode

Set `readOnly = true` when another billing integration owns purchases, for example while you
migrate from it. Observed and restored transactions are then sent to `sync-transaction` with
observer mode enabled, and are left unacknowledged for the host billing integration. Voidhash
records such a purchase without acknowledging or consuming it, on the device or on its servers, so
the host decides whether and when it is acknowledged. `purchase(...)`, including a purchase from a
flow, throws `READ_ONLY_PURCHASE_NOT_ALLOWED` before Play Billing is touched.

`setReadOnly(true)` and `setReadOnly(false)` switch modes at runtime. A purchase already in
flight keeps the mode it started with, so the SDK still finishes a purchase it started even if the
app switches to observer mode while the Play sheet is open.

Store calls throw `VoidhashException`, never a Play Billing exception type: `getProducts()` throws
`FAILED_TO_GET_PRODUCTS`, and `syncPurchases()` and `restorePurchases()` throw
`BILLING_CONNECTION_FAILED` when the Play Billing connection does not open (including a setup that
does not finish within 15 seconds) or `STORE_UNAVAILABLE` when Play cannot list owned purchases.
A query, an acknowledgement or a consumption Google Play does not answer within 30 seconds fails
the same way instead of waiting.

#### Managing subscriptions and the store

| Call                                          | What it does                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `showManageSubscriptions(activity, product?)` | Opens Google Play's subscription center: the product's subscription, or every subscription without one.                    |
| `presentCodeRedemption(activity, code?)`      | Opens Google Play's promo code page, with the code filled in. What the user redeems arrives through `transactionUpdates`.  |
| `getStorefront()`                             | The country Google Play bills the user in (ISO 3166-1 alpha-2), from Play's billing configuration. Play names no currency. |
| `canMakePayments()`                           | Whether Google Play can be reached and billing is available for the signed-in account.                                     |

The person's `subscriptions.all` lists every subscription that has not ended, also one in a grace
period, in billing retry, on hold or paused: what a subscription screen shows. `subscriptions.current`
is the one that matters most, and `subscriptions.history` and `purchases.history` list the rest.
Every status, store and environment has an `UNKNOWN` value, so a newer server never breaks the SDK.
Access comes from the entitlements, never from these lists.

#### Google Play

`voidhash.googlePlay` holds what only Google Play offers:

- `showInAppMessages(activity)` shows Play's transactional messages, such as a prompt to fix a
  declined subscription payment. When the user fixed a subscription it returns
  `SubscriptionStatusUpdated(purchaseToken)`, after the SDK synced the store and refreshed the person.
- `queryPurchases(includeSuspended = true)` lists the purchases the Play account owns, subscriptions
  Play suspended (paused, or on hold after a declined renewal) included, with
  `googlePlay.isSuspended`. Reading them changes nothing. The SDK never delivers, acknowledges or
  consumes a suspended purchase.
- `isFeatureSupported(feature)` asks the Play Store about a `BillingClient.FeatureType`.

The public types carry Play Billing's own (`ProductDetails`, `Purchase`), so the SDK's API depends
on the Play Billing Library's major version: this release uses Play Billing 9.

#### Not supported

External purchase links, alternative billing and Play's other billing programs, subscriptions with
add-ons and multi-line purchases, and prepaid-plan top-ups are not part of the SDK.

### Report purchases from another billing SDK

In observer mode, report the purchases your billing integration makes.

Call `reportTransaction(...)` after each successful host purchase and for each restored transaction.
Only an Apple transaction ID or Google Play purchase token is required. Voidhash supplies the current
SDK identity and configured bundle/package; the backend fetches and verifies the store purchase.

```kotlin
// In an app-owned coroutine; use the purchase token, not the order ID.
voidhash.reportTransaction(purchaseToken)
```

You can also pass a Google Play Billing `Purchase` directly. Voidhash reads its token and purchase
state, then discards other fields, original JSON and signature. Pending purchases are ignored;
report them again when purchased. A token-only report from a completed callback needs no purchase
time, quantity, product ID or order ID. The server verifies the current state with Google Play.

Blank tokens and multi-product `Purchase` objects throw `INVALID_TRANSACTION`. Reporting does
not require a Billing connection; delivery failures stay queued without throwing into the host
purchase callback.

Initialize Voidhash and identify the buyer before starting the purchase flow. Reporting never
finishes, acknowledges or consumes a transaction. It writes the identifier to disk before returning
and delivers it in the background. When the device cannot store it (a full disk, for example) it
throws `TRANSACTION_NOT_DURABLE` after starting delivery from memory; delay consuming the purchase
and report it again. Duplicate reports preserve the original captured identity across retries and
relaunches. Each delivery attempt that
fails or is not confirmed is reported through `onDiagnostic` as `TRANSACTION_SYNC_DEFERRED`.

Use `syncPurchases()` for a silent recovery scan when a host callback exposes no usable store
transaction values. It scans currently exposed purchases, skips receipts already accepted by
Voidhash, and refreshes person state. Store-read failures reach the caller; delivery failures stay
queued for retry. It does not prompt for store authentication. Once Google Play has listed the
purchases it waits at most 10 s for Voidhash; a delivery that is still running then carries on in
the background, and a second call while it runs waits for the same delivery, or for one of its own
behind it when Google Play lists a purchase the first did not know. Either way every receipt the
call listed is stored on the device before it returns, so you can consume a purchase once
`syncPurchases()` has returned.

A report not marked as a restore is a purchase the user just made, sent as a `purchase`: it goes to
the user it was reported for, even when the Google account's earlier purchase gave another user
access, as do purchases the SDK makes itself. The server honours it only for a purchase Google Play
made in the last 24 hours and records an older one for its current owner. It is sent even when a
scan had the purchase accepted already, and stays a `purchase` across retries and relaunches. A
purchase is claimed once from a device: reporting it again, also after another user signed in,
sends nothing.

Silent syncs, background scans and observer callbacks never move a purchase to another person. The
SDK remembers on disk which receipts Voidhash accepted, for whom and whether they were claimed, so
a scan after a sign-out or an account switch does not resubmit the previous user's purchases for
the new one, and a renewal (a new order on the same purchase token) is reported for the purchase's
owner. These submissions are sent as `sync`.

Connect your Restore Purchases button to `restorePurchases()`. It revalidates restorable purchases
for the identity that requested the restore, including receipts already accepted for another user.
It and reports marked as restores are the only submissions sent as a `restore`; a restore queued
offline keeps that intent across relaunches. For a restore, the project's paid access sharing
setting decides whether a purchase that already gives another user access is shared, transferred
or kept with that user. Previously queued purchases retain their original identity and are delivered before the
restore.

Restore queries currently owned Play purchases. Google Play has no separate restore prompt and
does not return consumed purchases or arbitrary expired subscription history.
Known consumables are excluded from explicit restoration. A store error or a receipt that cannot
be accepted fails the restore (`RECONCILE_TRANSACTIONS_FAILED` for the receipt); deferred receipts
remain queued. Like `purchase`, a restore waits at most 10 s for Voidhash once Google Play has
listed the purchases: one that has not finished by then throws `RECONCILE_TRANSACTIONS_FAILED` and
carries on in the background, each receipt queued as a restore before it is sent. Calling
`restorePurchases()` again while it runs waits for the same restore rather than starting another.
A receipt the backend refuses outright (Google Play not configured for the package,
an unknown token, an environment mismatch) is kept but not retried until the next launch or for six
hours, whichever comes first, and is reported once through `onDiagnostic` as `TRANSACTION_REJECTED`. An empty store can restore
successfully. Check the refreshed person's entitlements to decide whether to unlock access.
Use silent sync after a host restore for discovery; call explicit restore when Voidhash must
revalidate cached receipts for the current user or give them a purchase another user has. When the
user asked your own billing integration to restore purchases, report each purchase it returns with
`isRestore = true`: it is sent as an explicit restore for the current user, like
`restorePurchases()`, even when Voidhash already accepted it, and stays one across retries and
relaunches.

```kotlin
voidhash.reportTransaction(purchase, isRestore = true)
```

Initialization, foreground and reconnect also perform recovery scans. Foreground/reconnect scans
are throttled to once a minute per trigger. Scans cannot recover a consumable already
finished or consumed by the host, or arbitrary expired subscription history. Use explicit reporting
whenever transaction values are available.

### Identity

```kotlin
voidhash.getDistinctId()
voidhash.identify(externalUserId = "user-123", email = "a@b.co", name = "Ada")
voidhash.setPersonAttributes(mapOf("plan" to "pro"))
val person = voidhash.getCurrentPerson(forceFetch = true)
val hasPremium = person?.hasActivePerk("premium") == true // the perk slug from Studio
voidhash.signOut()
```

Check access by the perk's Studio slug with `hasActivePerk(slug)`, or read `activePerkSlugs`.
Each grant also carries `perkId`, the perk's internal id, and `perkSlug`, its slug.

External user ids may contain any characters, including non-Latin scripts and leading or trailing
spaces. The SDK encodes them for transport and the API decodes them, so the id you pass is the id
Voidhash stores. An id the API refuses is a programmer error: `identify` throws `VoidhashException`
with the code `INVALID_ARGUMENT` and keeps the current identity, online or offline. That is an
empty or whitespace-only id, one longer than 255 characters (Unicode code points), one containing
a NUL character, and one starting with `vh_anon_` or `vh:anon:`, the prefixes of the SDK's
anonymous ids.

Trait values are flat: strings, numbers, booleans or `null`. A map or a list throws
`INVALID_ARGUMENT` before anything is sent or queued, online or offline. Non-finite numbers are
sent as `null`. The attributes `email` and `name` with a string value are the person's email and
name, and are sent as such rather than as traits. A confirmed write returns the person as Voidhash
wrote it, and caches it. A map with nothing to send sends and queues nothing; it reports
`WriteStatus.DEFERRED` while a write for the person is still queued and `WriteStatus.CONFIRMED`
otherwise.
Attributes are what your app says about the person, so they are written whatever the analytics
consent; only agreeing to [ad data sharing](#ad-data-sharing) needs it.

`identify` can be called whenever your app learns who the user is, such as on every launch.
Repeating it for the current user with the same email and name as the last time sends nothing,
also while that identify is still queued, when it reports `WriteStatus.DEFERRED`; a changed email
or name is sent, and so is an identify Voidhash refused. Every `identify` lifts the pause a
rejected publishable key put on requests.

`signOut()` ends a signed-in user's time: it captures `$sign_out`, then starts a fresh anonymous
id and analytics session. `$sign_out` is recorded only with analytics consent; it is never held
for a pending one. While nobody is signed in, that is while the distinct id is an anonymous
one, it does nothing, so it is safe to call from every signed-out state.

`reset()` is exactly `signOut()` for a signed-in user. It differs only while nobody is signed in:
there it starts a fresh visitor, with a new anonymous id, no groups and a new analytics session,
and records and sends nothing. Use it for a shared device, a guest who starts over, and tests.

`initialize()` and `signOut()` never wait for an `identify` request in flight, and an `identify`
cancelled after it switched the local identity stays queued. Calling `identify` again for a user
whose earlier `identify` is still queued keeps the anonymous id that one links, so a purchase made
before sign-in is still merged into the user.

`VoidhashOptions.distinctId` adopts your id at once. When the device used an anonymous id before,
`initialize()` queues an alias from that id to yours, so its purchases and history merge into
your user; nothing is sent from `configure`. A `distinctId` the API would refuse, such as a blank
one, is ignored with a warning.

### Feature flags

```kotlin
val flags = voidhash.getFeatureFlags(listOf("new_onboarding"))
val enabled = flags.firstOrNull { it.key == "new_onboarding" }?.enabled == true

// A variant's payload is untyped JSON: a JSONObject, JSONArray, String, Number, Boolean or null.
val config = flags.firstOrNull { it.key == "onboarding_copy" }?.payload as? JSONObject
val headline = config?.optString("headline")
```

With nothing cached a flag read waits at most `FeatureFlagOptions.maxWaitMs` (2 s). Give flags a
default for that case, read them synchronously with `isFeatureEnabled`, and collect
`featureFlags` to update the UI when an evaluation arrives:

```kotlin
val voidhash = Voidhash.configure(
    context,
    "pk_live_...",
    VoidhashOptions(featureFlags = FeatureFlagOptions(defaults = mapOf("new_onboarding" to false))),
)

val enabled = voidhash.isFeatureEnabled("new_onboarding") // memory only, never waits
lifecycleScope.launch {
    voidhash.featureFlags.collect { render(voidhash.isFeatureEnabled("new_onboarding")) }
}
```

A default answers only for its own key: in `isFeatureEnabled`, and as a flag without a variant in
`getFeatureFlags` results for keys you asked for that have no evaluated value.

### Analytics

```kotlin
voidhash.capture("checkout_started", mapOf("source" to "paywall"))
voidhash.flush()
```

Events are batched (20 events, or every 5 seconds while the app is in the foreground, and once
when it goes to the background) and persisted to disk within 250 ms of capture, so they survive
the process being killed. Retries are unbounded and backed off, honouring `Retry-After` from the
response header and body, up to 30 s. Encoding and writing the queue run on the SDK's writer thread, never on
the thread that called `capture`.

Event names are trimmed. An event with a blank name, or captured with no distinct id to attribute
it to, is not queued and is reported as `ANALYTICS_EVENT_INVALID`. The ingest API refuses a whole
batch for one invalid event, so a refused batch is halved until the invalid event is alone: the
others are delivered and only that event is dropped, with `ANALYTICS_EVENT_DROPPED`. An event too
large to send is found and dropped the same way. An event is only dropped when the ingest API
itself refuses it: a refusal without a Voidhash error body, as an edge or a proxy gives, keeps the
event. From then on, also after a restart, it is retried in a request of its own, after the events
that are due, so it never holds them back; it leaves the queue only when it is accepted, the API
itself refuses it, or the queue's capacity evicts it. Such refusals count against the circuit
breaker once per batch, and only when no request of the batch was accepted.

Events captured before `initialize()`, yours and the automatic ones, are written to the queue as
soon as the SDK's storage has loaded, each with the time it was captured, and sent once the client
is initialized. They are attributed to the stored identity, or to a new anonymous id on a device
that has none yet.

Automatic lifecycle events:

- `$app_installed` / `$app_updated`: the first launch of an install, or of a new version or
  build. Always the first events of a launch.
- `$app_opened`: the first activity start of the process. A process Android starts in the
  background, for a push message, a job or a broadcast, records none until the user brings up an
  activity. There `initialize()` also leaves connecting to Google Play and refreshing the schema,
  person and flags to that first activity start. Configure Voidhash in `Application.onCreate` so
  the SDK sees it.
- `$app_backgrounded`, then `$app_became_active` when an activity returns in the same process.
- `$app_crashed`: a crash or ANR from `ActivityManager.getHistoricalProcessExitReasons`, read off the
  launch path once an activity is started, on API 30 and later. It carries `crash_kind` (`crash`,
  `native_crash` or `anr`) and the running `$app_version`, and nothing from the system's record. The
  SDK installs no signal or uncaught exception handler.

Report a notification the end user opened with `trackPushOpened(intent.extras)` or
`trackPushOpened(remoteMessage.data)`. It records `$push_opened` with its
`push_notification_send_id`, and ignores a notification Voidhash did not send. The SDK does not extend
your messaging service, so it does not see notifications on its own.

Requests carry `x-is-backgrounded: true` while no activity of the app is started.

`flush()` delivers everything that is due, in order: person writes, then store receipts, then
events. It half-opens an open circuit and probes a paused key first (at most once a minute), and
returns once each queue was tried, or after 2 s with `lastError` "Delivery is still in progress"
while delivery carries on. One flush sends at most ten batches of events. The `FlushStatus` it returns describes which events went out
and which are still queued; it never throws for transport.

```kotlin
val status = voidhash.flush()
status.flushed // events the server accepted
status.pending // events still queued
status.lastError // why the flush stopped early, if it did
```

### Groups

Put the end user in a group, such as the company or workspace they use your app as part of, and
every later event carries it in `$groups`:

```kotlin
voidhash.group("company", "acme", mapOf("name" to "Acme", "seats" to 40))
voidhash.groups // {company=acme}
voidhash.resetGroups()

// Or state every group the user belongs to in one call.
voidhash.setGroups(
    mapOf(
        "company" to VoidhashGroup("acme", mapOf("name" to "Acme", "seats" to 40)),
        "team" to VoidhashGroup("design"),
    ),
)
```

`setGroups` replaces the whole set: a type missing from the map, or mapped to `null`, is left, and
an empty map leaves every group. It sends a `$groupidentify` for a group only when its id changed
or its properties differ from the ones `setGroups` last sent for it, so calling it again with the
same groups sends nothing and it can run wherever your app loads the user. Several descriptions
from one call go out in order of group type. Leaving a group sends
nothing. An entry with an invalid type or id is left out with a warning.

`group` and `resetGroups` return at once, and Java callers get `group(type, key)` and
`group(type, key, properties)`. A group type is a lower-case letter followed by up to 63 lower-case
letters, digits or underscores; a key has 1 to 256 characters. Anything else is ignored with a
warning. The end user belongs to one group of each type. `group` sends a `$groupidentify` with the
group's properties (strings, numbers or booleans) when you pass some or when the group of that type
changed. Groups are stored with the distinct id, kept by `identify` and cleared by `reset()` and by
a `signOut()` of a signed-in user; an event keeps the groups it was captured under while it waits in the queue, and a group
the event names in its own `$groups` wins for its type.

Groups are what your app says about the end user, so they are described whatever the analytics
consent. While consent is not granted, the `$groupidentify` is sent at once as a request of its
own instead of through the analytics queue, holding only the group's type, key and properties, the
distinct id and the time: no session, no device properties. Nothing is stored for it and it is not
retried, and `setGroups` sends a description that did not reach Voidhash again on its next call.
Before the first unlock after a reboot these
calls are held, in order with the identity calls around them, and `groups` is empty.

### Analytics consent

```kotlin
// Before the user has decided.
val voidhash = Voidhash.configure(context, "pk_live_…", VoidhashOptions(analyticsConsent = AnalyticsConsent.PENDING))

// Once they have.
voidhash.setAnalyticsConsent(if (accepted) AnalyticsConsent.GRANTED else AnalyticsConsent.DENIED)
```

Consent answers one question: may Voidhash record what this person does? Only `GRANTED` collects
usage analytics; `DENIED` and `PENDING` behave the same. Without consent `sessionId` is empty and the SDK captures no
events, screens or lifecycle events, including flow events, stores no analytics session, reads no
install attribution and does not write an agreement to ad data sharing. No event is queued, stored
on the device or sent, and `$app_installed` / `$app_updated` waits for a later grant. Requests to
Voidhash carry `x-analytics-consent: denied` or `pending`.

What your app says about the person is not gated: `identify` (including the email and name),
person attributes, and groups with their properties are sent in every state, since flags and
cohorts target on them. Purchases, restores, receipts, entitlements, feature flags and flows work
as before too.

`setAnalyticsConsent` takes effect before it returns and stores the choice on the device, where it
wins over the `analyticsConsent` option on every later launch; `signOut()` and `reset()` keep it.
Withdrawing consent deletes the events still queued, cancels a batch in
flight and drops the analytics session. Granting it collects from then on; nothing from the time
without consent is sent. `analyticsConsent` reads the current value.

By default events captured while consent is `PENDING` are dropped. With
`VoidhashOptions(analyticsWhilePending = PendingAnalytics.BUFFER)` they are held in memory instead,
each with the time it happened: custom events, screens and lifecycle events.
Nothing is stored or sent meanwhile, and the 100 most recent events are kept; older ones are
reported as one `ANALYTICS_EVENT_DROPPED` with their count once the user decides. Granting consent
records them in order and with their own times, for the identity, groups and session in effect
then, behind `$app_installed` / `$app_updated` when one is due, which takes the time of the
earliest of them; denying it discards them. `$sign_out` is not held. `DENIED` never buffers. Person attributes and group
descriptions are not held either way: they are sent at once.

With `VoidhashOptions(grantConsentOnIdentify = true)` signing in counts as agreement: an `identify`
made while consent is `PENDING` grants it, so buffered events are recorded for the anonymous id the
identify then links to the user. `DENIED` is never overridden. A consent granted this way is
remembered across launches and lasts until the user signs out: `signOut()` and `reset()` send
what is queued, waiting at most two seconds, and return the consent to `PENDING`. Calling `setAnalyticsConsent` makes the decision the app's own, which `signOut()` and
`reset()` keep.

Revenue reporting is unaffected. Metrics built from analytics events, such as paywall impressions
and conversion rates, only include users who granted consent.

### Ad data sharing

`setAdDataSharing(true)` records that the end user agreed to you sharing their purchases with ad platforms, as the
person trait `$ad_data_sharing`. Unlike other person attributes it needs analytics consent: without it the agreement
is not written, and one still queued is dropped when consent is withdrawn.
`setAdDataSharing(false)` takes it back: analytics consent neither blocks nor discards that. It is stored on the
device and retried until Voidhash has written it, or for 48 hours while Voidhash has no such person, and
it records no analytics. Setting the trait to `false` as a person attribute does the same. Declining
analytics does not take it back by itself, so when someone rejects everything, call both `setAdDataSharing(false)` and `setAnalyticsConsent(AnalyticsConsent.DENIED)`.

### Install attribution

On a new install the SDK reads the Google Play install referrer and records the campaign it names on
the person as a touch (`$initial_*` and `$latest_*` traits), which a later `identify` carries over from
an anonymous person. The `utm_*` parameters, click IDs and `campaign_id`, `adset_id` and `ad_id` are
read under the same rules as the web SDK. Play's organic default and a referrer without those
parameters record nothing. The time comes from the server's click time, then the client's, then now;
a `touch_at` in the referrer, which `playStoreUrl()` on the web writes, replaces it when earlier, so an
old ad click does not look fresh. One in the future or unreadable is ignored, and `touch_at` alone is no
touch. A referrer carries campaign values only: an identity in it is never adopted.

With `metaAppId` set, the SDK first asks the Facebook, Instagram and Facebook Lite apps, whose answer
is preferred over Play's. The SDK's manifest declares the `<queries>` they need. Meta's encrypted
referrer, from those apps or in a Play `utm_content`, is sent as `meta_referrer_data` and
`meta_referrer_nonce` for the backend to decrypt. Add the decryption key to the project's Meta settings.

It runs once per install, off the launch path, once an activity has started, and only while analytics
consent is granted: a grant later runs it then, and a withdrawal cancels it. A device without Play is
settled for good and reported as `INSTALL_ATTRIBUTION_ABANDONED`. A service that is unavailable or
disconnects, a Meta app that fails while Play has no touch, and a touch that could not be written to
disk are reported as `INSTALL_ATTRIBUTION_DEFERRED`, and a later launch asks again, up to 10 launches. An install that already held an identity when this SDK version first ran is not read. A
reinstall counts as new, even where Android restored the SDK's storage from a backup. Pass
`installAttribution = false` to turn it off.

### Screen tracking

Resumed activities are recorded as `$screen` once their resume has completed, so a Compose
Navigation tracker attached in the activity's first frame (`VoidhashScreenTracking.attach`)
replaces the activity as the screen, and a rotation reports neither the recreated activity nor the
current destination again. With `ScreenTrackingOptions(fragments = true)` resumed fragments are
screens too, and only activities showing a tracked fragment are left out. Fragments without a
view, hidden fragments and dialogs are skipped. A fragment is named by its Navigation destination's
route or label (Navigation 2.4 or later), else by the tag you gave it, else by its class name. R8
renames fragment classes that no layout or navigation graph mentions, so release builds should tag
fragments created in code or keep their names:

```text
-keepnames class * extends androidx.fragment.app.Fragment
```

### Flows

A flow is a paywall, or another sequence of screens such as an onboarding, designed in Studio and
published to a location, the spot in your app where it is shown. Flows are drawn with Android's own
views by the `ui` module. Depend on `com.voidhash:voidhash-ui` and the SDK finds its renderer by
itself (`FlowRendererDiscovery`); configure the capabilities your flows may use. Set
`VoidhashOptions.flowRenderer` only to draw flows with a renderer of your own.

```kotlin
// app/build.gradle.kts
dependencies {
    implementation("com.voidhash:voidhash:0.1.2")
    implementation("com.voidhash:voidhash-ui:0.1.2")
}
```

```kotlin
val voidhash = Voidhash.configure(
    context,
    "vh_pk_…",
    VoidhashOptions(
        flowCapabilities = setOf(FlowCapability.LINKS, FlowCapability.ATTRIBUTES),
    ),
)
```

`presentFlow` shows the flow assigned to a location fullscreen, edge to edge, above the activity
you pass, and returns once it is gone. The result has the same shape for every ending: its
`outcome`, the flow's `output`, and the `productId` when a purchase ended it. A flow that cannot be
shown is a failure, not an outcome, and is thrown as a `FlowException`:

```kotlin
val result = try {
    voidhash.presentFlow(activity, "onboarding")
} catch (error: FlowException) {
    when (error.reason) {
        FlowFailure.NOT_ASSIGNED -> Unit // nothing published to this location for this user
        FlowFailure.UNAVAILABLE -> Unit // nothing cached and Voidhash unreachable, or not ready within 15 s
        FlowFailure.RENDERER_MISSING -> Unit // the app does not depend on com.voidhash:voidhash-ui
        FlowFailure.UNSUPPORTED_PACKAGE -> Unit // published for a newer SDK; update it
        FlowFailure.PRESENTATION_FAILED -> Unit // could not be shown, or stopped while on screen
        FlowFailure.DISABLED -> Unit // the client is disabled or shut down
    }
    return
}
when (result.outcome) {
    FlowResult.PURCHASED -> unlockPro() // result.productId is the store product id
    FlowResult.RESTORED -> refreshAccess()
    FlowResult.DISMISSED -> Unit // closed by the flow, the back button or dismissFlow()
    else -> saveAnswers(result.outcome, result.output) // the outcome the flow finished with, such as "completed"
}
```

#### Inputs, outputs and app actions

What a location exchanges with the app is its interface: inputs the app passes, outputs it reads
back, the outcomes a flow can end with, and app actions a flow may call. Values are a `String`, a
number or a `Boolean`; anything else is dropped with a warning, and numbers read from a flow are
`Double`.

```kotlin
val result = voidhash.presentFlow(
    activity,
    "onboarding",
    input = mapOf("firstName" to user.firstName, "credits" to 3),
    actions = mapOf(
        "pickGoal" to FlowActionHandler { arguments ->
            mapOf("goal" to openGoalPicker(current = arguments["current"] as? String))
        },
    ),
)
val goal = result.output["goal"] as? String ?: "none"
```

- An input that is not passed keeps its default in the flow. `updateFlowInput(mapOf("credits" to 2))`
  changes inputs of the flow on screen, and does nothing when none is shown.
- `output` holds the flow's outputs however it ended: with a finish or close they are the ones it
  reports then, and after a purchase, a restore or `dismissFlow()` the ones it reported last. Read
  each with a default; a flow that does not have an output leaves it out.
- A handler receives the action's arguments by name and returns the fields of its reply. A handler
  that throws, and a call to an action the app passed no handler for, fail that call in the flow,
  which carries on as it was designed to; the user is never left waiting on the app. A debug build
  logs a call without a handler, naming the action and the location. Handlers still running when
  the flow ends are cancelled.

Every change to a location's interface makes a new revision. Report the one the app was built
against, so a user is only shown a flow this build can answer: per location in
`VoidhashOptions(flowRevisions = mapOf("onboarding" to 3))`, which also applies to preloading, or
per call with `presentFlow(activity, "onboarding", revision = 3)`. Without one the app counts as
revision 0. A cached answer is only used for the revision it was fetched for.

Typed code for a location can be generated by the Voidhash CLI. It declares a `FlowLocation` with
the location's slug and revision, a `FlowInput`, a `FlowActions` and the output and outcome types,
for the typed call:

```kotlin
val result: TypedFlowResult<OnboardingFlow.Output, OnboardingFlow.Outcome> =
    voidhash.presentFlow(activity, OnboardingFlow.location, OnboardingFlow.Input("Ada", 3.0), actions)
```

`NoFlowInput` and `NoFlowActions` stand in for a location without inputs or actions.

#### Presentation

`dismissFlow()` can be called from any thread. It closes the flow on screen, and cancels one that `presentFlow` is still resolving or
downloading, so it never appears later over whatever the user is doing by then; a download already
under way finishes, and the flow is cached. Only one flow is on screen at a time: presenting another
closes the current one, whose `presentFlow` returns the outcome `dismissed`, and cancelling the coroutine that
called `presentFlow` dismisses its flow.

A flow that has to wait for the network shows a loading screen 0.4 s after `presentFlow`, at least
long enough to be read, until the flow has drawn above it: a progress indicator TalkBack announces
as loading (the `voidhash_flow_loading` string, English only; the app can translate it) and a
cancel button, on the theme's `android:colorBackground`. It follows the activity through a
recreation. A flow already on the device appears before then, without it. The cancel button, or
back, ends the presentation as `dismissed` with `FlowResult.wasShown` `false`, which a flow the end
user closed has `true`; it is reported as `$paywall_load_cancelled` (`cancelledBy: "end_user"`) once
an answer named the flow. Set `loading` on a `FlowViewRenderer` you pass as `flowRenderer` to
`FlowLoading.Custom { context, cancel -> … }` for a view of your own, or to `FlowLoading.None` to
keep your screen until the flow is ready.

A location the device has never loaded shows nothing while Voidhash can't be reached, as on a first
launch offline. To show a flow then, ship it in the app's `assets/voidhash-flows/`: the location's
answer as `<location>.json` and its build as `<location>.vhfp`, which
`voidhash location bundle <location> --out app/src/main/assets/voidhash-flows` writes (pass
`--revision <location>=<n>` for a location presented with a revision). Without the CLI, save what
`resolvePaywallJson(location)` returns, captured as a fresh anonymous person outside any A/B test,
pin or rule, with `"notAfter"`, an ISO 8601 time, and `"interfaceRevision"`, a whole number, added,
and download its build from the answer's `flowPackage.url`. It is read off the main thread
and shown only when the device has no answer for the location and couldn't reach Voidhash (no
connection, a timeout, a server error); never when Voidhash answered, an error or an earlier empty
answer included, after `notAfter`, when the build's SHA-256 or revision doesn't match, or once the
device has heard that the build was withdrawn. On a first launch offline it is shown however old
it is, until `notAfter`. Purchases from it carry `source: "bundled"` in their paywall context, and
every flow event carries `packageSource` (`network`, `cache` or `bundled`).

A flow stays up when Android recreates the activity under it for a configuration change, such as a
rotation, a switch to dark mode, another font size or locale, or a resized window: the SDK shows the
same flow again above the recreated activity, and `presentFlow` keeps waiting for its result, also
that of a purchase that was in progress. Call `presentFlow` from a coroutine that outlives the
activity, such as one in `viewModelScope`: one launched in the activity's `lifecycleScope` is
cancelled when the activity is destroyed, which dismisses the flow. An activity that goes away for
any other reason closes the flow as `dismissed`, and so does a recreated activity that finishes
before it starts.

A flow that comes back on screen, after a recreation or after the app was in the background or the
screen was off, comes back where the end user was: on the same screen, with the screens before it
for the back button, the keyboard on the field that had it and the variables saved until then (see
[Saved progress](#saved-progress)). What it was waiting for goes on: a timer, your app's answer to an
app action, a purchase in progress. Scroll positions start at the top again, and a text field bound
to no variable comes back empty. It is still the same presentation: viewed once and ended once, with
no screen or event of the flow tracked again (see [Flow analytics](#flow-analytics)). A later
presentation starts at the flow's first screen.

To come back, the SDK keeps where the end user is in memory with the presentation. That includes
the values the flow's waiting logic works with, which can be what the end user typed, though never
what was typed into a password field. It is never written to disk, logged or sent anywhere, and it
goes when the presentation ends; only the flow's variables are saved, as before. A purchase started
from a repeated element, such as a plan card in a list, goes on at its result when the same card is
shown again; when the list changed meanwhile, the purchase still ends the flow if it is set to, and
a failure shows the flow's own message.
A single frame that fails to draw is drawn again; the flow ends with `PRESENTATION_FAILED` only after
three failed frames in a row.

Purchases and restores started from a flow go through the SDK, like `purchase(...)` and
`restorePurchases()`. A successful one ends the flow as `purchased` or `restored`; a failed,
cancelled or pending one shows its outcome in the flow and leaves it on screen, so the user can try
again. In observer mode, purchases from a flow fail with `READ_ONLY_PURCHASE_NOT_ALLOWED` and the
flow shows the failure. A flow buys a subscription with its introductory offer, as `purchase` does
by default, or with the offer the flow names.

A flow names products by slug; a flow built before slug references names them by Play product id,
which resolves to the first product with that id. Each product reaches the flow with its `period`
as text — `month`, `year`, `3 months`, `2 weeks`; `lifetime` for a development-mode product whose
development period is `lifetime` — and its free trial as `trial` — `1 week`, `3 days` — when the user can get one.

A purchase started from a flow is reported with the paywall it was made on, so its revenue, and
the revenue of its renewals, is credited to the location, paywall, release and experiment variant
in Voidhash analytics, also when Google Play completes a pending payment later. Purchases made
outside a flow and restores are not credited to a paywall.

#### Flow analytics

Each call to `presentFlow` that gets an answer naming a flow is one presentation, and the SDK
reports how it went through the analytics queue, with analytics consent like any other event:

| Event                     | When                                                                           | Properties                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$paywall_viewed`         | The flow is configured and drawn: once per presentation                        | `loadDurationMs` from the call, `flow_screen_index` and `flow_screen_name` of the first screen, `productsUnavailable: true` when it is shown without its store products                                                                     |
| `$paywall_load_failed`    | It failed before it was viewed                                                 | `reason`: `package_download_failed`, `package_integrity_failed`, `package_unsupported`, `runtime_download_failed`, `render_failed` (the flow could not be drawn or started), `timeout` (not ready within 15 s) or `other`; `loadDurationMs` |
| `$paywall_load_cancelled` | It was given up before it was viewed                                           | `cancelledBy`: `app` (`dismissFlow`, a cancelled coroutine, another presentation, `shutdown`, its activity finishing) or `end_user` (the loading screen's cancel button or back); `loadDurationMs`                                          |
| `$paywall_completed`      | A viewed flow ended through an end step, or a purchase or restore that ends it | `completion`: `end_step`, `purchase` or `restore`                                                                                                                                                                                           |
| `$paywall_dismissed`      | A viewed flow was closed any other way                                         | `reason`: `close` (the flow's close action, which the back button triggers from its first screen), `app` (as for `cancelledBy`) or `error` (it could no longer be drawn)                                                                    |

Every event about a flow, the flow's own included, carries `packageSource` once its build is
loaded: `network`, `cache` or `bundled`.

A presentation reports exactly one of the first three, then, once viewed, one ending, unless the
app's process ends first. The back button is passed to the flow, which goes back a screen or, from
its first one, closes as its close action does, so it is reported as `close`; `cancelledBy:
end_user` and `reason: system`, which other platforms send for a system gesture, practically never
occur on Android. A preload, a launch or foreground refresh and `resolvePaywall` are not
presentations, and a call that gets no flow to show (nothing assigned, or nothing cached while
Voidhash is unreachable) reports nothing. Retrying after a failure is a new presentation; a flow
shown again after a configuration change is not, also when the activity was recreated while the
flow was still loading. `shutdown()` closes the flow on screen first, so its ending is part of the
final flush.

Every one of these, the events the flow tracks itself (captured like `capture(...)`) and each
screen the user reaches (recorded like `screen(...)` with `flow_screen_index`) carry
`paywallLocationId`, `paywallShowingId`, `paywallId`, `paywallReleaseId` and `paywall_location`
(the location's slug). No property carries a message of the device, the store or an error.

When an A/B test chose what a location shows, a person is counted in the test when the SDK
presents the flow, or when the paywall is handed to your app's own UI by `resolvePaywall`,
`resolvePaywallState` or the React Native `getPaywallForLocation`, including a call made only to
see what is assigned. Each such hand-off is reported as `$paywall_handed_off`. Prefetching,
preloading and refreshing count nobody. `VoidhashApiClient.resolvePaywallRaw` called without
`reportsExposure` lets Voidhash count the person on resolving.

#### Text inputs

A flow can ask the user to type: a name, an email address, a code. Tapping a text input shows the
keyboard the input asks for (text, email, number, decimal, phone or URL, with its return key), and
the flow keeps what it shows above the keyboard. The return key moves to the next input or puts the
keyboard away, as the flow says. The back button first puts the keyboard away, then goes back in
the flow. Hardware keyboards work too, with the usual shortcuts for moving, selecting, undo and the
clipboard.

What the user types stays in the flow and reaches your app as one of the flow's outputs (see
[Inputs, outputs and app actions](#inputs-outputs-and-app-actions)); it is sent to Voidhash only
where the flow's author added an action for it. The text of a password input is masked, cannot be
copied, and the keyboard is asked not to learn from it.

An input that says what it holds, such as an email address, a password or a one-time code from an
SMS, is offered to the device's autofill service while it has the keyboard. Autofill sees one input
at a time, so a password manager fills a sign-in form field by field and does not offer to save
what was typed.

TalkBack, Switch Access and Voice Access see each text input as an edit field, named by its
accessibility label or placeholder. Activating it shows the keyboard; its text can be dictated or
replaced, and while it has the keyboard the cursor moves by character, word and line, with cut,
copy and paste. A password input's text is never read out. A disabled input or button is announced
as unavailable, and a slider is adjusted with the usual swipe up and down. A link, a pressable part
of a text or an element whose role is link, is announced as a link and listed in TalkBack's links
menu, from which it can be opened; on Android 6 to 7.1 it reads as text that can be clicked.

`presentFlow` needs nothing from your activity for this. If you put a `FlowView` in a
layout of your own, it works best in a window drawn edge to edge or one with
`android:windowSoftInputMode="adjustResize"`. `adjustPan` is not recommended: Android then moves
the window as well as the flow making room.

#### Capabilities

Anything a flow does beyond showing screens, purchasing and restoring needs a capability you grant
in `flowCapabilities`. An action needing a capability you did not grant is dropped, and the SDK
logs a warning with `debug = true`.

| Capability      | Lets a flow                                                                             |
| --------------- | --------------------------------------------------------------------------------------- |
| `LINKS`         | Open links in the browser or the app that handles them. Granted by default              |
| `ATTRIBUTES`    | Set attributes on the current person, as `setPersonAttributes(...)` does                |
| `NOTIFICATIONS` | Ask the user for permission to post notifications                                       |
| `TRACKING`      | Ask for tracking permission. Android has no such prompt, so the request answers `false` |

On Android 13 and later, a notification request shows the system prompt. Declare the permission
in your app's manifest, or the SDK refuses the request with a warning and the flow is told it was
not granted:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Earlier Android versions have no prompt; the flow is told whether notifications are enabled for
the app.

#### Saved progress

A flow's own variables, such as the answers given so far, are saved on the device for each paywall
and person as they change. Presenting the same paywall again resumes with them; inputs always
come from the app. They are cleared
when the flow finishes, when a purchase from it succeeds, and when the person signs out or
identifies as someone else.

#### Offline

The SDK downloads each flow's package, verifies it against the hash the API names and keeps it on
disk, so a flow shown once still shows offline. A location's configuration is cached for seven
days, and a location the device has resolved before is preloaded on the next launch, package
included, so `presentFlow` renders without waiting on the network. `preloadLocations` covers the
first launch, which has nothing to remember yet. Preloading asks for the revision in
`flowRevisions`, or else the one the location was last presented with. The `ui` module ships native code for
`arm64-v8a`, `armeabi-v7a` and `x86_64`; on other devices flows report `UNSUPPORTED_PACKAGE`.

A flow's images are kept on disk too, so a cached flow shows its backgrounds, product art and icons
while the host serving them cannot be reached. The SDK fetches the images a package lists, up to
64 of them, in the background when it preloads a location or loads its package, and keeps every
image a flow displays. Fetching ahead never uses a metered connection such as cellular data, runs
once per package while the app runs, and stops at 32 MB per package; an image a flow displays is
loaded on any connection. An image is read from the device first and downloaded only when it is not
there. The images take at most 64 MB, beyond which the ones used longest ago are deleted; only
`http` and `https` images of up to 10 MB are loaded, and only PNG, JPEG, GIF and WebP images: a
response that is not one of them, such as a proxy's or firewall's page answered in an image's
place, counts as a failed download and is never kept, and an image the flow cannot decode after
all is removed, so the next presentation fetches it again. They are the same for every person, so
`reset()` and `signOut()` leave them in place. An image that cannot be loaded is left out and
reported as a warning; it never fails or delays a flow.

An answer is fresh for five minutes, a flow or "nothing here" alike. After that, `presentFlow` and
`resolvePaywall` ask Voidhash again and wait at most 500 ms for the reply before using the cached
answer, and offline they use it at once; it stays usable for seven days. When the app comes to the
foreground or the device reconnects, at most once a minute, the SDK refreshes the locations whose
answer is no longer fresh, one at a time, and leaves the rest for later when a request fails. So a
change to what a location shows, a release withdrawn or a location switched off reaches an online
device within about five minutes of its next presentation or foreground.

A release withdrawn as bad is never shown again: not when an answer cached before still names it,
and not as the package a location falls back to while its new one cannot be downloaded. Its
package is deleted from the device unless another location still uses it. A presentation that has
nothing else to show then fails with `UNAVAILABLE`.

`presentFlow` gives a flow 15 seconds, from the call until the flow is ready to show, to resolve
its location and download its package. A flow that is not ready by then is not shown: it would
appear over whatever the user went on to do. The call throws a `FlowException` with
`FlowFailure.UNAVAILABLE`, and the download finishes in the background, so the next `presentFlow`
for the location shows the flow from the cache. A flow that is on screen has no time limit.

Without a renderer no flow can be shown: `presentFlow` throws `RENDERER_MISSING`,
`resolvePaywall(...)` returns `null` and `preloadLocations` is inert.

#### Runtime modules

By default flows run on the flow runtime built into the `ui` module, so a release is shown only in a
package format this SDK reads. With `FlowViewRenderer.runtimeMode = FlowViewRenderer.RuntimeMode.MODULE`,
set before the SDK resolves its first flow, each release runs on the runtime module it names
instead, whatever its package format: the SDK downloads the module once, verifies it by hash, keeps
it in `cacheDir/voidhash/runtime-modules` and, while it cannot, runs the module it bundles when that
runs the release. A presentation waits at most three seconds for a module. Two differences remain
in this mode: a native component cannot write its props back, and a text input in a package format
only the module reads gets its keyboard settings when first focused.

### Shutdown

```kotlin
val status = voidhash.shutdown()
```

Closes the flow on screen and cancels one still loading, whose `presentFlow` returns `dismissed`
and whose analytics are part of the final flush. Then writes anything captured but not yet
persisted to disk, flushes analytics for at most 2 s, waits
for the SDK's writes still under way to reach disk, and ends the Play Billing connection in the
background. Events the final flush did not send stay on
disk for the next client configured with the same publishable key and base URL. Returns the same `FlushStatus` as `flush()`. It also stops
the retry timer, the activity callbacks and the connectivity monitor; a disabled client sends nothing and returns an empty status. The client stops even when the final
flush fails or the coroutine calling `shutdown()` is cancelled during it, for example by a
`withTimeout`.

A shut-down client stays shut down, and `Voidhash.shared` returns `null` until the next
`configure`. `identify`, `setPersonAttributes`, `reset`, `getProducts`, `purchase`,
`restorePurchases` and `syncPurchases` throw `VoidhashException` with the code `CLIENT_SHUT_DOWN`
rather than a cancellation. `capture` and `screen` do nothing, `flush()` returns an empty status,
and reads answer from the cache. A receipt reported to it is written to disk and delivered by the
next client you configure with the same publishable key and base URL.

## Migrating from earlier alpha releases

- **Placements are locations, and a flow ends with one result.** `presentFlow(activity, placement)`
  is `presentFlow(activity, location, revision, input, actions)`, and `preloadPlacements` is
  `preloadLocations`. `FlowResult` is no longer five cases: it is a class with `outcome`
  (`purchased`, `restored`, `dismissed`, or the outcome the flow finished with), `output` and
  `productId`, the slug of the product bought. `Closed` is the outcome `dismissed`. `FlowResult.Failed` is gone: a flow that
  cannot be shown is thrown as the `FlowException` it used to carry, so wrap the call in
  `try`/`catch`. A finished flow no longer hands back all of its variables; read the outputs it
  declares from `output`. See [Flows](#flows).
- **The billing API follows Play Billing 9.** `VoidhashProduct` drops `id`, `displayPrice`,
  `price: Double`, `currency`, `billingPeriod`, `googlePlayOfferToken(s)` and `isSubscription`:
  use `storeProductId` or `productId`, `price` (a `VoidhashPrice`), `subscription.period`, `offers`
  and `type`. One product per Studio product, so two base plans of one Play subscription are two
  products. `purchase(activity, product, options)` takes `VoidhashPurchaseOptions` instead of
  `offerId` and `replacing`, buys a subscription's free trial by default, and returns a
  `VoidhashPurchaseResult`: a cancelled sheet, a pending payment and a disabled client are results,
  no longer the exceptions `USER_CANCELLED`, `PURCHASE_PENDING` and `CONFIGURATION_MISSING`.
  `VoidhashTransaction` is rebuilt: `id` is the purchase token, Play's fields are under
  `googlePlay` (`appAccountToken` is `googlePlay.obfuscatedAccountId`), and `purchasedAt` replaces
  `purchaseDate`. `transactionUpdates` emits a `VoidhashTransactionUpdate` (`transaction` and
  `synced`). `restorePurchases()` returns the person. `VoidhashPerson.currentSubscription` is
  `subscriptions.current`, next to `subscriptions.all`, `subscriptions.history` and
  `purchases.history`. A schema cached by an earlier
  release is fetched again, as it lacks the product ids.
- **Paywalls are flows.** `presentPaywall`, `presentPaywallForStatus`, `PaywallStatus` and
  `PaywallListener` are removed, and so is the WebView paywall. Add the
  `com.voidhash:voidhash-ui` dependency and call `presentFlow(activity, location)`,
  which returns how the flow ended. React to the outcomes `purchased` and `restored` where you used
  `onPurchaseCompleted` and `onRestoreCompleted`. Flows that open links, set attributes or ask
  for permissions need the matching `flowCapabilities`. `ResolvedPaywall` now describes the
  release's flow package instead of an HTML page.

The other changes are behaviour changes; existing call sites keep compiling.

- **Anonymous ids start with `vh_anon_`.** Ids an earlier build stored keep their `vh:anon:`
  prefix and stay anonymous. To tell an anonymous id from a user id, call
  `isAnonymousDistinctId(id)` rather than comparing with `ANONYMOUS_DISTINCT_ID_PREFIX`.

- **`$app_opened` is the first activity start of the process.** It used to be captured by every
  `initialize()`, including in processes started in the background for a push or a job, while the
  user's real launch in such a process recorded nothing. A background start also no longer
  connects to Google Play or refreshes remote state until an activity starts, and requests say
  whether the app is backgrounded.
- **One invalid event no longer costs its batch.** A batch the ingest API refused used to be
  dropped whole; now only the invalid event is. Blank event names are no longer queued.
- **Events captured before `initialize()` are stored at once and keep their capture time.** They
  used to wait in memory, capped at 100, until `initialize()`, and carried its time.
- **Fragment tracking no longer hides every activity.** With `fragments = true` only activities
  showing a tracked fragment are left out. Headless, hidden and dialog fragments are no longer
  screens, and a fragment's tag or Navigation destination names it before its class.
- **A Compose tracker attached in the first frame replaces the activity screen.** The host
  activity used to be reported on every launch and rotation.
- **The SDK runs in the main process only.** `configure` in any other process of the app returns
  an inert client instead of sharing the main process's storage, which processes used to overwrite
  for each other. Set `runInSecondaryProcess = true` if your UI runs in a named process.
- **Nothing runs before `initialize()`.** Foreground and reconnect used to open Google Play, send
  queued data and mint an anonymous id on a client that was configured but not initialized yet.
- **Queued receipts and person writes are retried on a timer** while the app is in the
  foreground, and `flush()` now delivers them too and waits for them. They used to wait for the
  next foreground, reconnect or launch.
- **A replaced or shut-down client stops for good.** Re-configuring used to leave the previous
  client's Google Play connection open and let it keep writing the SDK's files; `shutdown()` on it
  could stop the new client's connectivity monitor. Its store and identity calls now throw
  `CLIENT_SHUT_DOWN`, and a receipt reported to it goes to the new client or to disk.
- **`enabled = false` touches no storage.** A disabled client used to send the queued analytics on
  `shutdown()`, read the SDK's files and throw `IllegalStateException` from `purchase()`. It now
  sends nothing, keeps what an enabled client stored untouched, and `purchase()` returns
  `VoidhashPurchaseResult.Disabled`.
- **Release builds write nothing to logcat.** The SDK logged warnings, including user ids and
  purchase tokens, whatever `debug` said. It now logs only with `debug = true`, and no log line
  or diagnostic carries a user id or a purchase token. This includes the Play Billing connection
  and the background purchase check, which used to log product ids and Play response codes in
  every build.
- **`purchase()` no longer fails after the purchase went through.** It used to throw
  `BILLING_ERROR` when Google Play charged the user and Voidhash accepted the receipt but the
  acknowledgement failed. It now returns the transaction, and the SDK finishes the purchase later.
- **Two Play failures of `purchase()` have their own codes.** A product the user already owns
  throws `ITEM_ALREADY_OWNED`, and a purchase Google Play could not be reached for throws
  `STORE_UNAVAILABLE`; both used to be `BILLING_ERROR`. A Play failure whose message Google Play
  left empty now says what its response code means.
- **`restorePurchases()` and `syncPurchases()` wait at most 10 s for Voidhash.** Against a backend
  that did not answer they could take a minute. Once Google Play has listed the purchases, a
  restore still running after 10 s throws `RECONCILE_TRANSACTIONS_FAILED` and a sync returns; both
  carry on in the background.
- **In owner mode the purchase observer leaves other integrations' consumables alone.** It used to
  sync and consume a consumable the SDK did not start when Google Play announced it while the app
  ran. Report such purchases with `reportTransaction`.
- **Diagnostic codes were renamed.** `CIRCUIT_OPENED` is now `CIRCUIT_OPEN`,
  reported once per outage, and `CIRCUIT_CLOSED` reports the recovery. `ANALYTICS_FLUSH_RETRY` is
  now `ANALYTICS_SEND_FAILED`. `TRANSACTION_RECEIPT_UNCONFIRMED` is now
  `TRANSACTION_SYNC_DEFERRED`, which is also reported when a receipt sync fails on the network.
  `CACHE_WRITE_FAILED` is new. Some codes still differ from the web SDK's; see the mapping under
  [Offline behaviour](#offline-behaviour). `onDiagnostic` runs on a background thread in order; it used to
  run on whichever thread hit the situation, including the UI thread.
- **Backgrounding no longer waits for SDK writes.** The SDK saved its preferences with `apply()`,
  which Android finishes on the main thread at every activity stop, and rewrote the file on every
  captured event. It now saves synchronously on its own thread and writes the session less often.
- **A restored backup counts as a new install.** A reinstall or a new device restored from Auto
  Backup used to miss `$app_installed` and continue the old device's session.
- **Old receipt markers are cleaned up.** Markers the SDK keeps for recently processed purchases
  used to stay in the preferences file forever; expired ones are removed at launch.
- **`preloadLocations` is inert without a renderer.** It used to resolve paywalls and warm a
  WebView on every launch.
- **The install coordinate is `com.voidhash:voidhash`.** The documented `includeBuild` now works
  without a substitution block, and vendored modules can live under any project path.
- **`initialize()` no longer throws for transport.** It used to raise `FAILED_TO_FETCH_SCHEMA` on
  a cold cache with no connectivity, which crashed apps calling it from a bare
  `lifecycleScope.launch`. It now resolves once local state has loaded. `purchase(...)` still
  raises `CONFIGURATION_MISSING` while no schema is known.
- **Analytics and lifecycle observation start before the schema fetch**, so a cold offline launch
  no longer disables analytics for the process.
- **Expired cache entries are served instead of discarded.** Reads that used to return `null` for
  an entry past its TTL now return it with `isExpired = true`.
- **Analytics batches are no longer dropped after three send attempts.** Retries are unbounded;
  only the queue cap or a non-retryable server verdict drops an event.
- **`flush()` and `shutdown()` return `FlushStatus`** instead of `Unit`. Callers ignoring the
  result are unaffected.
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
- **Store failures throw `VoidhashException`.** Play Billing failures used to escape as
  `java.lang.Error`, which `catch (e: Exception)` does not catch. They now throw
  `FAILED_TO_GET_PRODUCTS`, `BILLING_CONNECTION_FAILED` or `STORE_UNAVAILABLE`, and a Play Billing
  setup that never finishes fails after 15 seconds instead of hanging restore and sync.
- **`VoidhashProduct.price` is read from Play's price in micros.** Comma-decimal prices such as
  "59,99 €" used to come out 100 times too high, and a subscription could take its price from
  another base plan or a free-trial phase.
- **Background scans never move a purchase to another person.** They used to resubmit accepted
  purchases under whoever was signed in once a 30-minute marker lapsed. Accepted receipts are now
  remembered on disk, and scans are a `sync` that keeps the existing owner; only a restore or a
  purchase just made can move one.
- **Only the API's own errors are verdicts.** A `5xx` outside `500`–`504`, an edge or proxy
  `4xx`, or an unreadable `2xx` used to drop queued analytics and person writes, throw from
  `identify` and `setPersonAttributes`, or clear a cached person. They are now retried like any
  outage: writes report `WriteStatus.DEFERRED`, and cached entitlements keep being served. The
  first `401`/`403` on a write, which used to throw and revert `identify`, is deferred the same
  way.
- **Invalid input throws `INVALID_ARGUMENT`.** An id the API refuses passed to `identify` (blank,
  longer than 255 characters, containing NUL or starting with `vh:anon:`), and a map or a list
  passed as a trait value, used to reach the API and fail there, or be queued offline, switch the
  device to an id no request could be made as, and be dropped later. Such a `distinctId` option is
  ignored.
- **A `409` from `identify` no longer restores the anonymous id.** That id already belongs to
  another user; restoring it made the device read that user's person and every later `identify`
  fail the same way. The device now keeps the user you identified.
- **A pinned `distinctId` links the anonymous id it replaces.** It used to overwrite a stored
  anonymous id without an alias, orphaning purchases made before the host knew its user.
- **Check perks by slug.** `EntitlementGrant.perkId` is the perk's internal id, not the slug
  you configure in Studio. Use `person.hasActivePerk("premium")`, `activePerkSlugs` or
  `EntitlementGrant.perkSlug`; `hasActivePerk` also matches grants cached by earlier releases.
- **Call `identify` as early as you know the user.** The SDK refetches the person and feature
  flags for you. Flags evaluated for the anonymous visitor answer for the user only until the
  user's own evaluation arrives, and never carry over from one user to another.
- **Calls you await no longer wait out an outage.** `flush()` and `shutdown()` return after at most
  2 s, `identify` and `setPersonAttributes` report `WriteStatus.DEFERRED` after 2 s, `purchase`
  returns at most 10 s after Google Play charged the user, and a flag read with nothing cached waits 2 s
  instead of 10 s. Delivery carries on in the background. A `Retry-After` is honoured up to 30 s
  instead of an hour, and every API request is bounded at 10 s instead of 30 s.
- **Only the API's own `401`/`403` is a rejected key.** One without a Voidhash error body, from a
  firewall or a proxy in front of the API, used to pause all outbound traffic and report
  `AUTHENTICATION_FAILED`. It is now retried like any outage, on the part of the API it came from.
- **A `429` pauses its part of the API.** It used to be retried on the next request or timer tick.
  Requests there now wait for the `Retry-After`, or five seconds, and repeated `429`s count towards
  the circuit breaker.
- **An answer that is not the endpoint's is not taken for one.** A `2xx` with an empty body, `{}`
  or another service's JSON in answer to `identify`, `setPersonAttributes` or a paywall read used
  to count as the API's answer: the write was dropped as delivered, a person without access or "no
  paywall" was cached. It is now retried, and the cached state stays.
- **A flow survives a configuration change, and `dismissFlow()` cancels one not on screen yet.**
  Rotating the device used to close a flow; it is now shown again above the recreated
  activity. `dismissFlow()` used to do nothing while a flow was resolving or downloading. A flow
  that returns from the background is configured from its latest saved variables and counted as one
  view, and one failed frame no longer ends it. See [Flows](#flows).
- **`presentFlow` gives up on a flow that is not ready after 15 seconds.** It used to wait up to
  about 30 seconds for the location and the package, and then show the flow over whatever the
  user was doing by then. It now fails with `FlowFailure.UNAVAILABLE` and keeps downloading for the
  next call. See [Offline](#offline).
- **A flow's images are kept on the device.** They used to be downloaded again for every
  presentation, so a cached flow showed without them while their host was unreachable. Up to
  64 MB of images are now stored in the app's cache directory and fetched ahead with the package.
- **A rejected key is probed more strictly.** A `2xx` that is not a JSON object, such as a proxy's
  page, no longer lifts the pause.
- **A process started before the device is unlocked gets a client that waits for the unlock.** The
  SDK used to end the app's process there, as the app's storage cannot be opened yet. The client
  holds what you ask of it and works once the device is unlocked; calls it can neither make nor
  hold throw the new code `DEVICE_LOCKED`. See [Configure](#configure).
