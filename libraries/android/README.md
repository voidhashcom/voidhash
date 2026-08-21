# @voidhash/android

The bare Voidhash Android SDK plus the shared native core every Voidhash Android surface reuses.

Two Gradle modules live here:

- **`:sdk`** (`com.voidhash.sdk`) — the public SDK: configuration, identity, products, purchases,
  paywalls, feature flags and analytics.
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
            voidhash.initialize()
        }
    }
}
```

`configure` is synchronous and cheap; `initialize()` connects to Google Play, resolves the project
schema and reconciles anything the store still reports as unfinished. The client is also reachable
as `Voidhash.shared` afterwards.

`VoidhashOptions`:

| Option | Default | Meaning |
| --- | --- | --- |
| `baseUrl` | `https://api.voidhash.com` | Voidhash API origin |
| `ingestUrl` | `baseUrl` | Analytics ingest origin |
| `debug` | `false` | Reports the build as a debug build and enables verbose logging |
| `distinctId` | `null` | Pins the initial distinct id instead of generating an anonymous one |
| `enabled` | `true` | When false the client is inert: no network, no billing connection |
| `readOnly` | `false` | Observer mode — transactions are synced but never finished with the store |

## API

Every method on `VoidhashClient` other than `capture`, `getDistinctId` and `setReadOnly` is a
suspending function.

### Products and purchases

```kotlin
val products = voidhash.getProducts()
val transaction = voidhash.purchase(activity, products.first())
voidhash.restorePurchases()
```

`purchase` launches the Play Billing flow from `activity`, syncs the resulting transaction to the
backend and then acknowledges it (or consumes it for `one-time-consumable` products). In observer
mode (`setReadOnly(true)`) the sync still happens but the store finish is left to the host app —
except for a purchase started before the flag flipped, which is always finished.

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

Events are batched (20 events or every 5 seconds) and retried with exponential backoff, honouring
`Retry-After`.

### Paywalls

```kotlin
voidhash.presentPaywall(activity, location = "onboarding", listener = object : PaywallListener {
    override fun onPurchaseCompleted(transaction: VoidhashTransaction) = unlock()
    override fun onEvent(name: String, properties: Map<String, Any?>) = track(name, properties)
    override fun onDismiss() = Unit
})
```

`presentPaywall` resolves the paywall configured for the location, presents it fullscreen and speaks
the paywall bridge protocol natively: purchases, restores, close and external links are handled for
you; custom events and logs are forwarded to the listener. It returns `false` when the backend has
no paywall showing for the location.

### Shutdown

```kotlin
voidhash.shutdown()
```

Flushes analytics and ends the Play Billing connection.

## Tests

```sh
pnpm --filter @voidhash/android test:kotlin
```

Runs `:core:testDebugUnitTest` and `:sdk:testDebugUnitTest` with the Gradle wrapper shipped by
`@react-native/gradle-plugin`. The suites are plain JVM unit tests (JUnit4, mockk, OkHttp
`MockWebServer`) — no emulator required.
