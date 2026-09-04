# Error Handling in Voidhash React Native

This document describes the consolidated error handling system used throughout the Voidhash React Native package.

## Overview

The error handling system provides consistent, descriptive error codes across iOS, Android, and TypeScript implementations. All errors follow the format:

```
ERROR_CODE: descriptive message
```

## Error Codes

### Initialization Errors

- `STOREKIT_NOT_INITIALIZED`: StoreKit connection not initialized
- `GOOGLE_BILLING_NOT_INITIALIZED`: Google Billing connection not initialized

### Product Errors

- `INVALID_PRODUCT_ID`: Product not found in store
- `EMPTY_SKU_LIST`: No SKUs provided for product query
- `SKU_NOT_FOUND`: The SKU was not found. Please fetch products first by calling getItems
- `SKU_OFFER_MISMATCH`: The number of SKUs must match the number of offer tokens for subscriptions

### Purchase Errors

- `PURCHASE_FAILED`: Purchase operation failed
- `USER_CANCELLED`: User cancelled the purchase
- `PURCHASE_PENDING`: The payment was deferred
- `PURCHASE_UNKNOWN_RESULT`: Unknown purchase result

### Transaction Errors

- `TRANSACTION_NOT_FOUND`: Transaction not found
- `TRANSACTION_VERIFICATION_FAILED`: Transaction verification failed

### Platform-specific Errors

- `WINDOW_SCENE_NOT_FOUND`: Could not find window scene for UI presentation
- `CURRENT_ACTIVITY_NULL`: Current activity returned null
- `BILLING_ERROR`: Google Billing operation failed

### Method Availability Errors

- `METHOD_NOT_AVAILABLE_TVOS`: Method is not available on tvOS platform
- `METHOD_NOT_AVAILABLE_PLATFORM`: Method is not available on this platform

### Network and API Errors

- `NETWORK_ERROR`: Network operation failed
- `API_ERROR`: API operation failed
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `AUTHENTICATION_FAILED`: Authentication failed

### Authentication Errors

- `AUTHENTICATION_FAILED`: The publishable key was rejected. Surfaced as a `VoidhashError` once, on
  the first read that had no cached value to answer with; every other operation keeps its data
  queued and reports through `onDiagnostic` instead. Outbound traffic pauses, one request is allowed
  through every 60 s, and `init()` clears the pause.

### Paywall Errors

- `PAYWALL_UNAVAILABLE`: No paywall configuration has ever been cached for this placement and the
  server cannot be reached. Not a failure: hide the paywall and try again once the device is back
  online, or warm the placement with the `preloadPlacements` client option. `show()` surfaces this
  as `{ status: "unavailable" }`.

### Configuration Errors

- `CONFIGURATION_MISSING`: Required configuration is missing
- `UNSUPPORTED_PLATFORM`: Platform is not supported

### General Errors

- `UNKNOWN_ERROR`: An unknown error occurred
- `OPERATION_FAILED`: Operation failed

## Usage

### In TypeScript/JavaScript

Errors live in `src/errors.ts`. `VoidhashError` is the base class and carries a stable
`code` property typed as `VoidhashErrorCode`. Every fallible client method returns a
better-result `Result<T, VoidhashError>` and never rejects:

```typescript
import { VoidhashError } from "./errors";

const result = await client.getCurrentPerson({ forceFetch: true });
if (result.isErr() && result.error.code === "FAILED_TO_GET_CURRENT_PERSON") {
  // branch on the failing operation
}
```

Subclasses: `FailedToInitializeNativeAdapterError`, `FailedToEndNativeAdapterError`,
`FailedToFetchSchemaError`, `NotInitializedError`, `SchemeNotSetError`,
`UnsupportedPlatformError`, `ReadOnlyModePurchaseNotAllowedError`,
`UnknownVoidhashError`. Each subclass pins its own code.

Client methods wrap every failure in a `VoidhashError` whose code names the failing
operation, such as `FAILED_TO_GET_CURRENT_PERSON` — match on `error.code`, not on the
message text. The full code list is exported as `VOIDHASH_ERROR_CODES`.

### In iOS (Swift)

```swift
import NitroModules

// Throwing errors with descriptive messages
throw RuntimeError.error(withMessage: "INVALID_PRODUCT_ID: Product not found in store")
```

### In Android (Kotlin)

```kotlin
// Throwing errors with descriptive messages
throw Error("SKU_NOT_FOUND: The SKU was not found. Please fetch products first by calling getItems")
```

## What is not an error

Transport failure is an expected state, not an error. A request that times out, cannot reach the
host, or comes back `408`/`429`/`5xx` never produces a `VoidhashError`:

- Reads (`hasPerk`, `getCurrentPerson`, `getFeatureFlags`, `getPaywallForLocation`) answer from the
  cached value and mark it `isStale`.
- Writes that can wait (`capture`, `setPersonAttributes`, `setPersonAttributesSync`, store receipt
  sync) are queued on device and retried until the server accepts them. `setPersonAttributesSync`
  reports this as `{ status: "deferred" }`.
- `init()` resolves once local state is loaded, whatever the network is doing.

The only failures the SDK cannot absorb are reads for which no fallback exists — a paywall placement
it has never resolved (`PAYWALL_UNAVAILABLE`), or a read with an empty cache behind a rejected
publishable key (`AUTHENTICATION_FAILED`, surfaced once) — and programmer errors such as calling a
method before `init()` (`VOIDHASH_CLIENT_NOT_INITIALIZED`).

Failures the SDK recovered from are reported through the `onDiagnostic` client option instead of the
error channel. Diagnostics carry a `kind` (`transport`, `eviction`, `breaker`, `auth`, `cache`), a
stable `code`, the `operation`, and whether the SDK will retry. Notably:

- `AUTHENTICATION_FAILED` — the publishable key was rejected (`401`/`403`). Outbound traffic pauses
  and queued data is kept, so fixing the key and relaunching delivers it. Reported once.
- `CACHE_WRITE_FAILED` — a write to device storage failed. The value is still held in memory and the
  next write retries.
- `CACHE_MIGRATION_FAILED` — entries written by a pre-namespace SDK release could not be moved into
  the namespace. They stay readable and the next launch retries.
- `BACKGROUND_TASK_FAILED` — an SDK-owned background task (a refresh chain, an outbox sync) failed
  outright rather than degrading.
- `TRANSACTION_RECEIPT_DROPPED` — a queued receipt can never be verified (for example an Android
  purchase with no purchase token) and was discarded.
- `TRANSACTION_SYNC_DEFERRED` — a receipt is still queued after a failed sync attempt.
- `ANALYTICS_EVENT_DROPPED` — an event was evicted because the queue reached its 1000-event cap, or
  the server refused it with a verdict re-sending cannot change.
- `CIRCUIT_OPEN` — a host failed five times in a row, so requests to it are skipped and the cache is
  served until the next probe.
- `CACHE_READ_FAILED` — an unreadable cache entry was discarded and treated as a miss.

## Error Handling Flow

1. **Native Module Error**: iOS/Android throws error with descriptive code and message
2. **Bridge**: Error message is passed to JavaScript runtime
3. **JavaScript Parsing**: `parseNativeError()` extracts error code and creates `VoidhashError`
4. **Application Handling**: Application can handle specific error codes or general error types

## Best Practices

1. **Always use descriptive error codes** that clearly indicate what went wrong
2. **Include additional context** when available using the `additionalInfo` parameter
3. **Handle specific error codes** in application logic when possible
4. **Provide fallback handling** for unknown errors
5. **Log errors appropriately** for debugging purposes

## Adding New Error Codes

To add a new error code:

1. Throw it from the native module with the `CODE: message` shape — `RuntimeError.error(withMessage:)`
   on iOS, `Error(...)` on Android — using the same code on both platforms.
2. Map it in the matching payment adapter under `src/core/payment-adapters/`, branching on
   `error.message.startsWith("CODE")` and raising the appropriate tagged error from
   `src/core/payment-adapters/errors.ts`. Add a subclass there when no existing one fits.
3. Update this documentation.
