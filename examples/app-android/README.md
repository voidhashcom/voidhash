# Nimbus for Android

The reference integration of [`@voidhash/android`](../../libraries/android) — a
single-activity Jetpack Compose app with three screens: notes, upgrade, account.
It is the Android member of the [examples suite](../README.md); every example
implements the same product, so the perk, product and event names below match
the other six.

## What it demonstrates

- Configuring the SDK in an `Application` and running `initialize()` off the
  main thread, with **loading, ready and failure** all rendered — the failure
  screen has a retry button, because `initialize()` talks to the network and to
  Google Play and both fail on a bad day.
- **Presenting a paywall and surviving its absence.** `presentPaywall` returns
  `false` when nothing is published for the location, and a project that has
  never published one answers the resolve call with a 404, which arrives as a
  thrown exception. Both mean *no remote paywall right now*, and neither is
  something a user should ever see. The app falls back to its own Upgrade
  screen. This is the single most valuable thing here to copy.
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
- A Voidhash **publishable key** (`vh_pk_…`) from
  [Studio](https://voidhash.com) → Project settings → API keys.

## Setup

Copy the sample properties file and paste your key:

```sh
cp local.properties.example local.properties
```

```properties
voidhash.publishableKey=vh_pk_your_key_here
```

`local.properties` is git-ignored, and `app/build.gradle.kts` reads the key from
it into `BuildConfig.VOIDHASH_PUBLISHABLE_KEY`. CI can set the
`VOIDHASH_PUBLISHABLE_KEY` environment variable instead. With neither, the app
still builds and runs — it renders setup instructions rather than pretending to
be configured.

In Studio, create the objects the example expects:

| Thing | Slug |
| --- | --- |
| Perk | `pro` |
| Products | `pro-monthly`, `pro-annual`, `pro-lifetime` |
| Paywall location | `onboarding` |
| Feature flag | `nimbus-new-onboarding` |

None of them are required to start the app. Missing products give you an empty
Upgrade screen with an explanation, and a missing paywall is exactly the
fallback path the example is built to show.

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
replaces the Play flow, and the recorded purchase is tagged with the development
environment so it never mixes with production data. Requests carry
`x-environment: development`, which scopes the person and its entitlements to
the test universe.

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

| Action | SDK call |
| --- | --- |
| Add note | `capture("note_created", …)` then `setPersonAttributes(mapOf("plan" to …, "notes_created" to …))` |
| Add note at the free limit | the upgrade flow below |
| Export | `capture("export_requested", …)`; Pro exports, everyone else gets the upgrade flow |

The upgrade flow is one function, `NimbusViewModel.requestUpgrade`, abridged
here down to the decision it makes:

```kotlin
val presented = try {
    sdk.presentPaywall(activity, location = "onboarding", listener = paywallListener)
} catch (error: Throwable) {
    false
}

if (presented) {
    sdk.capture("paywall_viewed", …)
} else {
    _events.emit(NimbusEvent.OpenUpgrade)
}
```

`paywall_viewed` is captured only when a paywall actually appeared. The SDK
handles purchase, restore, close and external links inside the paywall itself
and captures the paywall's own analytics events, so `PaywallListener` here only
refreshes entitlements — re-capturing in `onEvent` would double count.

### Upgrade

The app-owned screen the fallback lands on. `getProducts()` fills it,
`purchase(activity, product)` buys, `restorePurchases()` restores. A new project
has no published paywall, so **this is the first thing most users will see** —
it is written as a normal store page, not an error state.

`checkout_started` is captured before the store sheet opens. A cancelled
purchase is swallowed: `Throwable.isPurchaseCancellation()` walks the cause
chain for the SDK's `USER_CANCELLED` code, the same check the SDK's own paywall
coordinator makes.

### Account

| Section | SDK call |
| --- | --- |
| Sign in | `identify(externalUserId, email, name)` then `setPersonAttributes` |
| Person | `getCurrentPerson(forceFetch = true)` |
| Entitlements | `person.entitlementGrants` / `person.activePerkIds` |
| Feature flag | `getFeatureFlags(listOf("nimbus-new-onboarding"))` |
| Flush now | `flush()` |
| Sign out | `reset()` |

Pro is `person.activePerkIds.contains("pro")` — nothing else. `identify` aliases
the anonymous distinct id onto your own user id, so a purchase made before sign
in follows the user.

## What to steal for your own app

| File | Why |
| --- | --- |
| [`NimbusApplication.kt`](app/src/main/java/com/voidhash/example/nimbus/NimbusApplication.kt) | Where `configure` goes, and why `initialize` does not go there. |
| [`NimbusViewModel.kt`](app/src/main/java/com/voidhash/example/nimbus/NimbusViewModel.kt) | `requestUpgrade` (the paywall fallback), `isPurchaseCancellation`, and the per-action error handling. |
| [`ActivityFinder.kt`](app/src/main/java/com/voidhash/example/nimbus/ActivityFinder.kt) | Unwrapping `LocalContext` to the real `Activity`. Casting it directly is the classic first crash. |
| [`ui/NimbusApp.kt`](app/src/main/java/com/voidhash/example/nimbus/ui/NimbusApp.kt) | The loading / failure / ready gate with a retry button. |
| [`app/build.gradle.kts`](app/build.gradle.kts) | Reading a key out of `local.properties` into `BuildConfig`. |
| [`settings.gradle.kts`](settings.gradle.kts) | Wiring the SDK in as an included build. |

### How this example depends on the SDK

It lives inside the SDK repository, so it includes the sources directly:

```kotlin
includeBuild("../../libraries/android") {
    dependencySubstitution {
        substitute(module("com.voidhash:voidhash-android")).using(project(":sdk"))
    }
}
```

Your project installs the npm package and points at that instead:

```kotlin
includeBuild("node_modules/@voidhash/android") {
    dependencySubstitution {
        substitute(module("com.voidhash:voidhash-android")).using(project(":sdk"))
    }
}
```

Either way the app module depends on the coordinate, never on a repository:

```kotlin
dependencies {
    implementation(libs.voidhash.android)
}
```

The SDK contributes `android.permission.INTERNET` through its own manifest; the
app adds the other one:

```xml
<uses-permission android:name="com.android.vending.BILLING" />
```

## Notes on lifecycle

`MainActivity.onStop` calls `flush()`, because analytics are batched (20 events
or five seconds) and backgrounding is the natural point to drain the queue. It
deliberately does **not** call `shutdown()`: that also ends the Play Billing
connection, which a single-activity app should not do every time the user
switches away. `shutdown()` belongs in a process that is genuinely finishing.

## Toolchain

Matches the SDK's own build, because a composite build wants one toolchain:

| | |
| --- | --- |
| Android Gradle Plugin | 8.9.0 |
| Kotlin | 2.0.21 |
| Gradle | 8.11.1 |
| `compileSdk` / `targetSdk` | 35 |
| `minSdk` | 23 (the SDK's floor) |

## License

MIT — see [LICENSE.md](./LICENSE.md).
