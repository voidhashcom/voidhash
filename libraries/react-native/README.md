# Voidhash React Native SDK

React Native SDK for in-app purchases.

## Read-only observer mode

You can run the SDK in observer mode to coexist with other billing SDKs.

```ts
createVoidhashClient("pk_test", schema, {
  readOnly: true,
  scheme: "myapp",
});
```

Behavior summary:

| Mode | Starts purchases | Syncs transactions to Voidhash | Confirms/acknowledges store transactions |
|---|---|---|---|
| `readOnly: true` | No | Yes | No |
| `readOnly: false` (default) | Yes | Yes | Yes (after successful server sync) |

Observer reconciliation:

- The SDK attaches the native purchase listener first.
- Reconciliation runs in the background and does not block init.
- Reconciliation sources are pending transactions and active purchase history.
- Client-side dedupe key is `platform + transactionId + purchaseDate`.
- The server endpoint is idempotent by store transaction identity to tolerate retries/duplicates.

## Native paywall preloading + presentation

The SDK exposes `usePaywallByLocation(locationSlug, options?)` to preload and present paywalls with a native full-screen presenter.

```ts
const { show } = voidhash.usePaywallByLocation("onboarding", {
  onError: (error, context) => {
    console.error("Paywall action failed", context.action, error.message);
  },
  onPurchase: ({ productId, requestId }) => {
    console.log("Purchase succeeded", productId, requestId);
  },
  onRestore: ({ requestId }) => {
    console.log("Restore succeeded", requestId);
  },
});

const didShow = await show();
if (!didShow) {
  // no published paywall for this location
}
```

Behavior:

- Paywall assignment is resolved in JS (`getPaywallForLocation`), then preloaded in native (Swift/Kotlin).
- Presentation is native full-screen (no React Native `Modal` dependency).
- Preload runs on hook mount and when app returns to foreground.
- Pre-rendered native WebViews stay warm while hook instances are active for a location.

Bridge actions:

- Supported incoming actions: `purchase`, `restore`, `close`, `openExternal`, `log`.
- `purchase` and `restore` return structured response envelopes back to the paywall page (`success` / `error`).
- Successful `purchase` or `restore` auto-dismisses the presenter modal.
- Hook callbacks:
  - `onPurchase` fires after successful native purchase bridge action.
  - `onRestore` fires after successful native restore bridge action.
  - `onError` fires when `purchase` or `restore` bridge action fails.

### Add the package to your npm dependencies

```
npm install @voidhash/react-native
```

### Configure for Android

No additional setup necessary.

### Configure for iOS

Run `npx pod-install` after installing the npm package.

# Contributing
