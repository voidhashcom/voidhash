Read first: [[codeList .Platform.Reference]] (the API of the installed SDK)[[if .ClientFile]], `[[.ClientFile]]` (the client, already written)[[end]], the app's entry and root layout (with Expo Router `app/_layout.[[.ScriptExt]]x`, otherwise `App.[[.ScriptExt]]x` or what `index.js` registers), and wherever the app learns who the user is (sign-in, sign-out, session restore).

1. **Mount the provider once, at the root.** Import `voidhash` from `[[.ClientFile]]` and wrap the root component's tree in `<voidhash.Provider>`, outside navigation, next to the app's other providers:

   ```tsx
   import { voidhash } from "<relative path to [[.ClientFile]]>";

   export default function RootLayout() {
     return (
       <voidhash.Provider>
         <Stack />
       </voidhash.Provider>
     );
   }
   ```

   Keep every provider that is already there. Do not create another client: `[[.ClientFile]]` is the only call to `createVoidhashClient`.
   [[if eq .Platform.ID "expo"]]

2. **Register the config plugin.** Add `"@voidhash/react-native"` to `expo.plugins` in `app.json` (or the `plugins` array of `app.config.js`/`app.config.ts`), keeping the existing plugins. It configures the native projects on the next prebuild.
   [[else]]
3. **Native setup.** Nothing to add: autolinking links the SDK, which installs the native iOS SDK with Swift Package Manager on the next `pod install` and the Android SDK from Maven Central. Do not run `pod install`.
   [[end]]

4. **Identify the user.** Where the app has a signed-in user (after sign-in and when a stored session is restored), call `await voidhash.client.identify(userId, { email, name })` with the app's own stable user id; pass only the traits the app already has. It returns a `Result` and does not throw. Where the user signs out, call `await voidhash.client.signOut()`. If the app has no accounts, skip this step and say so in the report: Voidhash then keeps an anonymous id per install.
   [[if .Perk]]
5. **Gate on the perk `[[.Perk]]`.** Find where the app decides whether someone has its paid tier (a flag such as `isPro` or `isPremium`, a paywalled screen or a locked feature) and take the answer from Voidhash:

   ```tsx
   const { hasAccess, isLoading } = voidhash.useHasPerk("[[.Perk]]");
   ```

   Render the app's existing loading state while `isLoading`, and treat an error as no access. If the app has nothing paid yet, add nothing new: name in the report the place where the gate belongs.
   [[else]]

6. **Access checks.** The project has no perk yet, so add no access check. Say in the report where the app decides who has its paid tier, so a perk can be gated there later with `voidhash.useHasPerk("<perk>")`.
   [[end]][[if .Product]]
7. **Sell `[[.Product]]` from the app's own upgrade screen.** If the app has a screen or button where people upgrade, wire it; if it has none, add one small screen in the app's style and link it from the gate of step 4:

   ```tsx
   const { data: products, isLoading } = voidhash.useProducts();
   const { purchase, isLoading: isPurchasing } = voidhash.usePurchase();
   const product = products.get("[[.Product]]");
   // Show product.displayPrice. On press:
   const result = await purchase(product);
   ```

   `purchase()` never rejects: it resolves to a `Result`. Show an error only when `result.isErr()`; a closed store sheet is the status `cancelled` and is not an error; `pending` and `deferred` mean the perk unlocks later, so say so instead of failing. Show "unavailable" when the product is missing. Add a **Restore purchases** control that calls `voidhash.client.restorePurchases()`, which stores require.
   [[else]]

8. **Purchases.** The project has no product yet, so add no purchase code. Say in the report where an upgrade screen belongs.
   [[end]][[if .Location]]
9. **Present the paywall at `[[.Location]]`.** Where the app should offer the upgrade, present the location's paywall and fall back to the screen of step 5 when it cannot be shown:

   ```tsx
   const { present } = voidhash.usePresentFlow("[[.Location]]");
   try {
     const { outcome } = await present();
     // "purchased" and "restored" grant access; "dismissed" does not.
   } catch {
     // No paywall is assigned, or this build has no paywall renderer: show the app's own upgrade screen.
   }
   ```

   Presenting can reject (for example `FLOW_NOT_ASSIGNED`, `FLOW_RENDERER_MISSING`); the fallback is required, not optional.
   [[end]]
   Do not call `voidhash.client.capture` for screens or app opens: the SDK records app lifecycle and screens itself. Do not change `dev: true` in the client: release builds ignore it.

The slugs are typed: `voidhash.gen.d.ts` makes an unknown perk, product or location slug a type error, which the check below will catch.
