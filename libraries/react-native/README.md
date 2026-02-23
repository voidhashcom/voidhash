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

### Add the package to your npm dependencies

```
npm install @voidhash/react-native
```

### Configure for Android

No additional setup necessary.

### Configure for iOS

Run `npx pod-install` after installing the npm package.

# Contributing
