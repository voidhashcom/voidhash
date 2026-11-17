Read first: the app's entry (the `@main` `App` struct, or the `AppDelegate`), wherever the app learns who the user is, and [[if .TypesFiles]][[codeList .TypesFiles]] (the generated slug enums)[[else]]the project's Swift sources[[end]]. The Swift package `Voidhash` is added to the project by a person in Xcode; write code that imports it, and do not edit `.xcodeproj` or `.pbxproj` files.

1. **Configure the SDK once, at launch.** In the `App` struct's `init` (or `application(_:didFinishLaunchingWithOptions:)`):

   ```swift
   import Voidhash

   #if DEBUG
   let voidhashKey = "[[.TestKey]]"
   #else
   let voidhashKey = "[[.ProductionKey]]"
   #endif
   Voidhash.configure(publishableKey: voidhashKey, options: VoidhashOptions(dev: true))
   ```

   Then use `Voidhash.shared`. [[if .CustomAPI]]Pass `baseUrl: URL(string: "[[.APIURL]]")!` in the options. [[end]]Check the exact initializer of `VoidhashOptions` at [[.Platform.Docs]] before writing it.

2. **Identify the user.** Where the app has a signed-in user, call `try await Voidhash.shared.identify(externalUserId:email:name:)` with the app's own stable user id; on sign-out call `await Voidhash.shared.signOut()`. Skip this when the app has no accounts, and say so in the report.
   [[if .Perk]]
3. **Gate on the perk `[[.Perk]]`.** Where the app decides who has its paid tier, ask `try await Voidhash.shared.getCurrentPerson()?.hasActivePerk(VoidhashPerkSlug.<case>.rawValue)`, using the generated enum's case for `[[.Perk]]`. Treat an error as no access.
   [[end]][[if .Product]]
4. **Sell `[[.Product]]` from the app's own upgrade screen**, if it has one: `getProducts()`, then `purchase(productSlug:)`, which returns `.completed` or `.deferred` and throws when the person cancels or the purchase is pending; neither is a failure to show as an error. Add a restore control calling `restorePurchases()`.
   [[end]][[if .Location]]
5. **Present the paywall at `[[.Location]]`** with `try await Voidhash.shared.presentFlow(location:)`, falling back to the app's own upgrade screen when it throws.
   [[end]]
