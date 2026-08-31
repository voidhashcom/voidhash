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
            voidhash.initialize()
        }
    }
}
```

`configure` is synchronous and cheap; `initialize()` connects to Google Play, resolves the project
schema and reconciles anything the store still reports as unfinished. The client is also reachable
as `Voidhash.shared` afterwards.

`VoidhashOptions`:

| Option       | Default                    | Meaning                                                             |
| ------------ | -------------------------- | ------------------------------------------------------------------- |
| `baseUrl`    | `https://api.voidhash.com` | Voidhash API origin                                                 |
| `ingestUrl`  | `baseUrl`                  | Analytics ingest origin                                             |
| `debug`      | `false`                    | Reports the build as a debug build and enables verbose logging      |
| `distinctId` | `null`                     | Pins the initial distinct id instead of generating an anonymous one |
| `enabled`    | `true`                     | When false the client is inert: no network, no billing connection   |
| `readOnly`   | `true`                     | Forced on while commerce features are unavailable                   |
| `dev`        | `false`                    | Reserved for SDK-started test purchases                             |

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

Events are batched (20 events or every 5 seconds) and retried with exponential backoff, honouring
`Retry-After`.

### Paywalls

Hosted paywalls are temporarily unavailable. Their compatibility surface remains in the package
for the upcoming launch, but it performs no network or presentation work: `presentPaywall(...)`
returns `false` and `resolvePaywall(...)` returns `null`.

### Shutdown

```kotlin
voidhash.shutdown()
```

Flushes analytics and ends the Play Billing connection.
