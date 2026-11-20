# Nimbus for Android

The reference integration of the [Android SDK](../../libraries/android) — a
single-activity Jetpack Compose app with three screens: notes, upgrade, account.
It is the Android member of the [examples suite](../README.md); every example
implements the same product, so the perk, product and event names below match
the other six.

## What it demonstrates

- Configuring the SDK in an `Application` and running `initialize()` off the
  main thread, with **loading, ready and failure** all rendered — the failure
  screen has a retry button, because `initialize()` talks to the network and to
  Google Play and both fail on a bad day.
- **Presenting a flow and handling every way it ends.** `presentFlow` returns
  a `FlowResult` once the flow is gone, with its outcome: purchased, restored,
  dismissed, or the outcome the flow finished with. A flow that cannot be shown
  throws a `FlowException` with a reason. Nothing published for the location is
  one of those reasons, and not something a user should ever see: the app falls
  back to its own Upgrade screen. This is the single most valuable thing here
  to copy.
- **Development mode**, so a purchase completes on a bare emulator with no Play
  Console setup.
- Identity, person attributes, entitlement grants and a feature flag.
- Getting the `Activity` out of a Compose `LocalContext` correctly.
- Per-action error handling: a failed call becomes a snackbar or an inline
  message, and a purchase the user backed out of becomes nothing at all.

## Prerequisites

- **Android Studio Meerkat** (2024.3.1) or newer — the first release that
  understands AGP 8.9 — or the Android command-line tools.
- **JDK 17**. Android Studio ships one; `java -version` should say 17 if you
  build from a terminal.
- The Android SDK with **platform 35** and **build-tools 35**, resolved through
  `ANDROID_HOME` or the `sdk.dir` line Android Studio writes into
  `local.properties`.
- A Voidhash **publishable key** from
  [Studio](https://voidhash.com) → Project settings → API keys. Debug builds run in development
  mode, which needs the test key (`vh_pk_test_…`); a release build uses the production key
  (`vh_pk_…`) ([API keys](https://voidhash.com/docs/setup/environments#api-keys)).

## Setup

Copy the sample properties file and paste your key:

```sh
cp local.properties.example local.properties
```

```properties
voidhash.publishableKey=vh_pk_test_your_key_here
```

`local.properties` is git-ignored, and `app/build.gradle.kts` reads the key from
it into `BuildConfig.VOIDHASH_PUBLISHABLE_KEY`. CI can set the
`VOIDHASH_PUBLISHABLE_KEY` environment variable instead. With neither, the app
still builds and runs — it renders setup instructions rather than pretending to
be configured.

To point the app at another Voidhash API origin, add `voidhash.apiBaseUrl` (or
set `VOIDHASH_API_BASE_URL`). Debug builds allow cleartext HTTP to `10.0.2.2`,
the emulator's address for the machine it runs on, and to `127.0.0.1`, so a
local backend works either directly or through `adb reverse tcp:8788 tcp:8788`:

```properties
voidhash.apiBaseUrl=http://10.0.2.2:8788
```

In Studio, create the objects the example expects:

| Thing        | Slug                                        |
| ------------ | ------------------------------------------- |
| Perk         | `pro`                                       |
| Products     | `pro-monthly`, `pro-annual`, `pro-lifetime` |
| Location     | `onboarding`                                |
| Feature flag | `nimbus-new-onboarding`                     |

None of them are required to start the app. Missing products give you an empty
Upgrade screen with an explanation, and a location without a flow is exactly
the fallback path the example is built to show.

## Run it

Open this directory in Android Studio and press Run. There is no
`gradle-wrapper.jar` in the repository — binaries are not committed — so Android
Studio regenerates the wrapper the first time it opens the project. From a
terminal with Gradle 8.11.1 or newer already installed:

```sh
gradle wrapper           # writes gradlew and gradle-wrapper.jar
./gradlew :app:installDebug
```

`gradle/wrapper/gradle-wrapper.properties` pins Gradle **8.11.1**, the version
AGP 8.9.0 wants.

## Development mode

`NimbusApplication` configures the SDK with `VoidhashOptions(dev = true)`. In a
debug build that swaps Play Billing for a mock store: products are synthesized
from each dashboard product's development metadata, a "Test purchase" sheet
replaces the Play flow, and the recorded purchase is a test purchase, so it
never unlocks access in production. Simulated purchases need the test
publishable key (`vh_pk_test_…`); with the production key Voidhash refuses
them.

The flag is honored **only in debug builds**. A release build ignores
`dev = true` entirely and uses real Google Play Billing, so shipping the flag by
accident cannot give away your product.

That means the whole loop works on a stock emulator: buy `pro-monthly` from the
Upgrade screen, watch the `pro` grant appear on the Account screen, and see
Export stop asking for money.

## The three screens

### Notes

The list, the free-quota banner (`2 of 3 notes left`) and the Pro-only Export
action.

| Action                     | SDK call                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Add note                   | `capture("note_created", …)` then `setPersonAttributes(mapOf("plan" to …, "notes_created" to …))` |
| Add note at the free limit | the upgrade flow below                                                                            |
| Export                     | `capture("export_requested", …)`; Pro exports, everyone else gets the upgrade flow                |

The upgrade flow is one function, `NimbusViewModel.requestUpgrade`, abridged
here down to the decision it makes:

```kotlin
val result = try {
    sdk.presentFlow(activity, "onboarding")
} catch (error: FlowException) {
    _events.emit(NimbusEvent.OpenUpgrade)
    return
}
when (result.outcome) {
    FlowResult.PURCHASED -> { refreshPerson(); emitMessage("Purchased ${result.productId}") }
    FlowResult.RESTORED -> { refreshPerson(); emitMessage("Purchases restored") }
    FlowResult.DISMISSED -> Unit
    else -> emitMessage("Flow finished: ${result.outcome}")
}
```

The SDK handles purchase, restore, close and links inside the flow itself and
captures the flow's own analytics events and screens, so the app only reacts to
the result — re-capturing them would double count. The real function also logs
failures by reason: `NOT_ASSIGNED` and `UNAVAILABLE` are the normal "nothing to
show" cases, while `RENDERER_MISSING` means the setup below is incomplete.

### Upgrade

The app-owned screen the fallback lands on. `getProducts(listOf(...))` fills it
in the order given, `purchase(activity, product)` buys — with the free trial the
user can get, by default — and `restorePurchases()` restores and answers with
the person. A new project has no published flow, so **this is the first thing
most users will see** — it is written as a normal store page, not an error
state.

`checkout_started` is captured before the store sheet opens. `purchase` returns
a `VoidhashPurchaseResult`: a closed sheet is `Cancelled` and a payment Google
Play waits for is `Pending`, neither of them an error. The view model collects
`person` to keep the screens current, and `transactionUpdates` to tell the user
when a pending payment goes through.

### Account

| Section      | SDK call                                                           |
| ------------ | ------------------------------------------------------------------ |
| Sign in      | `identify(externalUserId, email, name)` then `setPersonAttributes` |
| Person       | `getCurrentPerson(forceFetch = true)`, the `person` flow           |
| Entitlements | `person.entitlementGrants` / `person.hasActivePerk("pro")`         |
| Feature flag | `getFeatureFlags(listOf("nimbus-new-onboarding"))`                 |
| Flush now    | `flush()`                                                          |
| Sign out     | `reset()`                                                          |

Pro is `person.hasActivePerk("pro")`, checked by the perk's Studio slug — nothing
else. `identify` aliases the anonymous distinct id onto your own user id, so a
purchase made before sign in follows the user.

## What to steal for your own app

| File                                                                                         | Why                                                                                                        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`NimbusApplication.kt`](app/src/main/java/com/voidhash/example/nimbus/NimbusApplication.kt) | Where `configure` goes, and why `initialize` does not go there.                                            |
| [`NimbusViewModel.kt`](app/src/main/java/com/voidhash/example/nimbus/NimbusViewModel.kt)     | `requestUpgrade` (the flow and its fallback), `isPurchaseCancellation`, and the per-action error handling. |
| [`ActivityFinder.kt`](app/src/main/java/com/voidhash/example/nimbus/ActivityFinder.kt)       | Unwrapping `LocalContext` to the real `Activity`. Casting it directly is the classic first crash.          |
| [`ui/NimbusApp.kt`](app/src/main/java/com/voidhash/example/nimbus/ui/NimbusApp.kt)           | The loading / failure / ready gate with a retry button.                                                    |
| [`app/build.gradle.kts`](app/build.gradle.kts)                                               | Reading a key out of `local.properties` into `BuildConfig`.                                                |
| [`settings.gradle.kts`](settings.gradle.kts)                                                 | Optionally building the SDK from this repository's sources.                                                |

### How this example depends on the SDK

As in your own project, the app module resolves the SDK from `mavenCentral()`:
`com.voidhash:voidhash` and `com.voidhash:voidhash-ui` (the `voidhash-android`
entries in `gradle/libs.versions.toml`, at the version set there):

```kotlin
dependencies {
    implementation(libs.voidhash.android)
    implementation(libs.voidhash.android.ui)
}
```

To build against the SDK sources in this repository instead, pass
`-Pvoidhash.sdkFromSource=true`: `settings.gradle.kts` then includes them and
Gradle substitutes their modules for those coordinates. Built from source, the
`ui` module has no native library, so the example then draws flows only once
that library has been added to `ui/src/main/jniLibs`.

`com.voidhash:voidhash-ui` is the renderer that draws flows; the SDK finds it
on its own once the app depends on it. `NimbusApplication` grants the flows
the `LINKS`, `ATTRIBUTES` and `NOTIFICATIONS` capabilities through
`VoidhashOptions.flowCapabilities`, so a flow can open links, set person
attributes and ask for the notification permission.

The SDK contributes `android.permission.INTERNET` through its own manifest; the
app adds billing, and the notification permission a flow may ask for on
Android 13 and later:

```xml
<uses-permission android:name="com.android.vending.BILLING" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## Notes on lifecycle

`MainActivity.onStop` calls `flush()`, because analytics are batched (20 events
or five seconds) and backgrounding is the natural point to drain the queue. It
deliberately does **not** call `shutdown()`: that also ends the Play Billing
connection, which a single-activity app should not do every time the user
switches away. `shutdown()` belongs in a process that is genuinely finishing.

## Toolchain

Matches the SDK's own build, because a composite build wants one toolchain:

|                            |                      |
| -------------------------- | -------------------- |
| Android Gradle Plugin      | 8.9.0                |
| Kotlin                     | 2.0.21               |
| Gradle                     | 8.11.1               |
| `compileSdk` / `targetSdk` | 35                   |
| `minSdk`                   | 23 (the SDK's floor) |

## License

MIT — see [LICENSE.md](./LICENSE.md).
