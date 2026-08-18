# React Native unified SDK API

Create the client with `createVoidhashClient(publishableKey, options)`. The common client methods are `init`, `capture`, `identify`, `reset`, `purchase`, `restorePurchases`, `flush`, and `end`. Captures use the identity, consent revision, session, and configuration that exist at capture time.

## `client.measurement`

- `configure(patch)` validates and applies collection, session, purchase, context, currency, locale, and protected-identity settings. Purchase observation supports iOS and Android purchase-kind enrichment callbacks; the returned object is validated and snapshotted at observation time.
- `start(options?)` starts or returns the current measurement session.
- `stop(options?)` independently stops collection, upload, or partner sharing.
- `handle(input)` records an explicit location or ATT observation.
- `on(event, listener)` subscribes to `error`, `attribution`, `attributionError`, `conversion`, `delivery`, `purchaseValidation`, or `session`.
- `getState()` returns a redacted local inspector.
- `createSupportBundle()` returns an opt-in, classifier-checked diagnostic document with hashed installation/session IDs.
- `getInstallationId()` returns the opaque local installation identifier.
- `createInviteLink(input)`, `trackInviteShare(input)`, and `trackCrossPromotion(input)` implement signed owned-media links.
- `trackAdRevenue(input)` records a decimal, currency-qualified ad impression.
- `validatePurchase(input)` returns a correlated `valid`, `invalid`, or `indeterminate` result. Inline receipts and legacy Android keys/signatures are rejected.
- `deleteData()` durably records deletion before protected local purge.
- `setTestDevice(enabled)` persists project test-device diagnostics across cold start.

## `client.links`

- `handle({ url, source, receivedAt? })` normalizes a manual or native link through allowlists, wrapped-domain limits, dedupe, and route projection.
- `on("deepLink", listener)` receives the single direct/deferred result stream. Results are `found`, `notFound`, or `error`; raw URLs are never returned.

## `client.consent`

- `set(snapshot)` requires a monotonically increasing revision and records the transition.
- `get()` returns the source snapshot and effective analytics, attribution, upload, and partner-sharing decisions.

## `client.notifications`

- `getPermissionStatus()` observes permission without prompting.
- `requestPermission(options?)` is the only permission-prompting path.
- `register()`, `unregister()`, and `getRegistration()` manage an opaque `pushDeviceTokenId`; raw platform tokens are protected and deleted after registration.
- `setBadgeCount(count)` sets or clears the native badge.
- `on(event, listener)` subscribes to `received`, `opened`, `tokenChanged`, and `registrationError`.

## Errors and capability results

All unified failures derive from `MeasurementError`. `MeasurementConfigurationError` identifies invalid configuration, `MeasurementInputError` invalid inputs, `MeasurementPolicyBlocked` an observable policy denial, and `MeasurementCapabilityUnavailable` an unavailable build/runtime capability. Capability reasons are `notConfigured`, `notImplemented`, `notInstalled`, `unsupported`, or `disabled`; calls do not silently succeed.

Release measurement logs are disabled unless an internal Ed25519-signed diagnostic session is valid for the current project and time. Debug and authorized release logs use the same recursive protected-field redaction.
