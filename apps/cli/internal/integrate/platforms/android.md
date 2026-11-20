Read first: the `Application` class (or the launcher activity when there is none), `settings.gradle(.kts)` and the app module's `build.gradle(.kts)`, wherever the app learns who the user is, and [[if .TypesFiles]][[codeList .TypesFiles]] (the generated slug enums)[[else]]the project's Kotlin sources[[end]]. Follow [[.Platform.Docs]] for the build setup: the SDK is on Maven Central and needs `implementation("com.voidhash:voidhash:<version>")` in the app module, with the version the documentation names, `mavenCentral()` among the build's repositories, and the `com.android.vending.BILLING` permission.

1. **Configure and initialize the SDK once, at launch**, in `Application.onCreate`:

   ```kotlin
   val voidhash = Voidhash.configure(
       context = this,
       publishableKey = if (BuildConfig.DEBUG) "[[.TestKey]]" else "[[.ProductionKey]]",
       options = VoidhashOptions(dev = true[[if .CustomAPI]], baseUrl = "[[.APIURL]]"[[end]]),
   )
   ProcessLifecycleOwner.get().lifecycleScope.launch { voidhash.initialize() }
   ```

   `initialize()` is required: nothing reaches Voidhash before it runs. Check the exact parameters of `VoidhashOptions` in the documentation before writing them.

2. **Identify the user.** Where the app has a signed-in user, call `identify(externalUserId = ..., email = ..., name = ...)` with the app's own stable user id; on sign-out call `signOut()`. Skip this when the app has no accounts, and say so in the report.
   [[if .Perk]]
3. **Gate on the perk `[[.Perk]]`.** Where the app decides who has its paid tier, ask `getCurrentPerson(forceFetch = true)?.hasActivePerk(VoidhashPerkSlug.<CONSTANT>.value)`, using the generated constant for `[[.Perk]]`. Treat an error as no access.
   [[end]][[if .Product]]
4. **Sell `[[.Product]]` from the app's own upgrade screen**, if it has one, with `purchase(activity, product)`, and add a restore control calling `restorePurchases()`.
   [[end]][[if .Location]]
5. **Present the paywall at `[[.Location]]`** with `presentFlow(activity, "[[.Location]]")`, falling back to the app's own upgrade screen when it throws.
   [[end]]
