# @voidhash/android

## 0.2.1

### Patch Changes

- In observer mode, `restorePurchases()` on iOS no longer calls `AppStore.sync()`, so you can call it after your other billing SDK's restore without the user being asked to sign in again: it sends what the device already has as a restore. The Restore button of a Voidhash paywall still refreshes the App Store. On React Native, a StoreKit JWS you report is now sent as the purchase's proof instead of being looked up again on the device, and on iOS `reportTransaction(transactionId:)` takes it as `signedTransaction:`.

## 0.2.0

### Minor Changes

- A purchase goes to the person who made it. When another account of your app on the same Apple ID or Google account had the subscription before, the new purchase now moves to the buyer instead of staying with that account. `reportTransaction` reports a purchase unless you pass `isRestore`, and launch scans, renewals and `syncPurchases()` never move a purchase. On iOS, purchases and restores carry the transaction as StoreKit signed it on the device, so a transaction ID alone can no longer move someone's purchase.

## 0.1.1

### Patch Changes

- On Android, a pressable part of a flow's text reaches TalkBack as a link rather than a button: TalkBack says "link" in the reader's language and lists it among the screen's links, and choosing it there or double-tapping it presses it.
- Flows tell VoiceOver and TalkBack what each layer is: a layer can carry an accessibility label (translated per language), a role (button, link, header or image), or be hidden from screen readers, and each pressable part of a text is reachable on its own. A pushed screen also settles faster when drawn outside the built-in renderer.

## 0.1.0

### Minor Changes

- First release on npm.
