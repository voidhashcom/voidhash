# Nimbus — React Native example

Nimbus is a notes app with a Pro tier. Free accounts keep three notes; Pro is unlimited and can
export. It is deliberately the smallest product that still needs everything an in-app purchase SDK
does: a paywall, products, purchases, restore, entitlement checks, identity, analytics and a feature
flag.

Three screens, plain React Native `StyleSheet`, no UI kit. Read it top to bottom in about ten
minutes, then copy the parts you need.

The same product exists for every Voidhash SDK — see [`../README.md`](../README.md) — so the Go
backend and the SwiftUI app use the same perk slug, product slugs and event names as this one.

## Not the debugging harness

[`../react-native-example`](../react-native-example) is the SDK team's internal harness. It exists
to exercise edge cases: raw JSON dumps, StoreKit corner cases. It is a useful
place to look when something is broken, and a bad place to look when you are starting.

This app is the opposite. Every screen is something you would ship, and every SDK call is one your
own app will make.

## What it demonstrates

| Surface                                                                | Where                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Provider, loading state, **failure state with retry**                  | [`components/voidhash-gate.tsx`](./components/voidhash-gate.tsx) |
| Entitlement check, including the stale-while-offline answer            | [`app/(tabs)/index.tsx`](<./app/(tabs)/index.tsx>)               |
| Presenting a paywall and handling **every** way it can end or decline  | [`lib/paywall-outcome.ts`](./lib/paywall-outcome.ts)             |
| Products, purchase, restore, and purchase outcomes that are not errors | [`app/(tabs)/upgrade.tsx`](<./app/(tabs)/upgrade.tsx>)           |
| Identify, person attributes, entitlement grants, feature flag, reset   | [`app/(tabs)/account.tsx`](<./app/(tabs)/account.tsx>)           |
| Analytics capture and flush                                            | across all three screens                                         |
| Client construction and development mode                               | [`lib/voidhash.ts`](./lib/voidhash.ts)                           |

## Prerequisites

- Node 20+ and pnpm.
- A **development build**. `@voidhash/react-native` ships native code, so Expo Go cannot load it.
  `pnpm ios` / `pnpm android` build one for you.
- Xcode for iOS or Android Studio for Android, at the versions Expo SDK 55 asks for.
- A Voidhash project. Create one in [Studio](https://voidhash.com), then copy the **publishable
  key** from Project settings → API keys. Publishable keys are meant to ship inside apps; the
  secret key (`vh_sk_…`) belongs on a server and never in this repo. Debug builds run in
  development mode, which needs the test key (`vh_pk_test_…`); a release build uses the
  production key (`vh_pk_…`)
  ([API keys](https://voidhash.com/docs/setup/environments#api-keys)).

## Configure

```sh
cp .env.example .env
```

| Variable                               | Required | Purpose                                     |
| -------------------------------------- | -------- | ------------------------------------------- |
| `EXPO_PUBLIC_VOIDHASH_PUBLISHABLE_KEY` | yes      | Your `vh_pk_test_…` key for debug builds.   |
| `EXPO_PUBLIC_VOIDHASH_BASE_URL`        | no       | Point the SDK at a local or staging API.    |
| `EXPO_PUBLIC_VOIDHASH_DEBUG`           | no       | `true` logs every SDK request and response. |

Expo inlines `EXPO_PUBLIC_*` variables at build time, so restart the bundler after editing `.env`.
Until the key is set, the app builds and runs but shows a setup card instead of the tabs — the
client is created with `enabled: false`, which keeps every hook mounted and every call a no-op
rather than crashing on the first request.

Slug arguments (`"pro"`, `"onboarding"`, `"pro-monthly"`) are typed as `string` until you generate
types for your own project:

```sh
npx voidhash-cli types generate
```

That rewrites `voidhash.gen.d.ts`, and the same call sites start autocompleting your real slugs.

## Run

```sh
pnpm install     # from the repository root
pnpm ios         # build and launch a development build on the iOS simulator
pnpm android     # ...or on an Android emulator
pnpm start       # bundler only, for an already-installed development build
```

`pnpm prebuild` regenerates the native projects if you change `app.json`. `pnpm typecheck` and
`pnpm lint` do what they say.

Paywalls are drawn by a native renderer that the Voidhash config plugin adds to the build.
`app.json` turns it on with `["@voidhash/react-native", { "renderer": true }]`; without it,
`present()` answers `FLOW_RENDERER_MISSING` and Nimbus opens its Upgrade screen instead.

## Development mode

`lib/voidhash.ts` passes `dev: true`. In debug builds that replaces the real store adapter with a
fake one: `getProducts()` returns the products configured in Studio priced from your project's
development configuration, and buying one opens a plain confirmation alert instead of a StoreKit or
Play Billing sheet. Confirm it and a test transaction is recorded against your project, the `pro`
perk is granted, and the Notes screen unlocks. Simulated purchases need the test publishable key;
with the production key Voidhash refuses them.

That means the full purchase → entitlement → unlock loop works on a simulator with no App Store
Connect and no Play Console setup. The SDK ignores `dev` unless `__DEV__` is true, so a release
build always talks to the real store.

## The screens

### Notes — `app/(tabs)/index.tsx`

The list, the quota banner and the two actions that touch Voidhash.

- `voidhash.useHasPerk("pro")` answers whether the user is Pro, matching the perk slug set in
  Studio. It also reports `isStale`, which is `true` while the answer comes from a cached snapshot
  the server has not confirmed recently. Nimbus shows a badge instead of revoking access — a paying
  customer on a train should keep their features.
- Creating a note captures `note_created` and writes the `notes_created` person attribute.
- Export captures `export_requested`. Pro exports; everyone else gets the paywall.
- `voidhash.usePresentFlow("onboarding")` presents the paywall published for the location.
  `present()` resolves once the paywall is gone and says how it ended: `purchased` and `restored`
  refetch access, and a `failed` presentation opens the Upgrade screen. A location the device has
  shown before is downloaded again at launch, so the next `present()` is usually instant.
- `lib/voidhash.ts` grants flows the `links` and `attributes` capabilities, so a paywall can open a
  link and store an answer on the person. Anything else a paywall asks for is ignored.

### Upgrade — `app/(tabs)/upgrade.tsx`

The app-owned fallback, and the screen a brand-new project sees before a paywall is published.

- `voidhash.useProducts(PRO_PRODUCT_SLUGS)` answers the three plans Nimbus knows, in that order,
  `undefined` for one the store does not sell; `useProducts()` adds anything else the store
  returned. Every hook shares one load, which runs again after a purchase or a sign-in.
- A plan's label comes from the product: `price.formatted`, and for a subscription its `period`
  and the free trial in `subscription.introOffer`, which a purchase applies by default.
- `voidhash.usePurchase()` runs the purchase. Its result is a `Result`, and its success value is
  `purchased`, `pending`, `cancelled` or `disabled`. `purchased` carries the transaction and
  `synced`: `false` means the store took the payment and Pro unlocks once the purchase reaches
  Voidhash. None of them is an error — a customer who dismisses the sheet did not fail.
  `pendingProduct` is the plan being bought, and a second tap on it answers the same purchase.
- `voidhash.useRestorePurchases()` reconciles past transactions and resolves with the refreshed
  person, so the screen says whether Pro came back without a second read.
- A Pro customer gets **Manage subscription**, which opens the store's subscription settings.
- `checkout_started` is captured before the store sheet opens.

### Account — `app/(tabs)/account.tsx`

- `client.identify(externalUserId, { email, name })` attaches the anonymous person to your user.
  The id comes from `lib/fake-auth.ts`, standing in for your auth system: it must be stable and hard
  to guess, never an email and never a sequential number.
- `client.setPersonAttributes({ plan, notes_created })` writes your own data onto that person. The
  update is stored on the device and sent in the background, retrying until it lands; the screen
  calls `client.flush()` when it wants delivery attempted now.
- `useCurrentPerson()` renders the person snapshot, including `entitlements.grants` — the grants are
  the answer behind `useHasPerk`, shown raw so you can see what the check is reading. Each grant
  names its perk by `perkSlug`, the slug `useHasPerk` matches; `perkId` is the perk's internal ID.
- `useFeatureFlags(["nimbus-new-onboarding"])` evaluates the flag for the current person.
  `getVariant(key)` returns `{ enabled, variantKey, payload }`, or `null` while the flag is loading
  or unknown. The hook compares the keys by value, so an inline array does not refetch on every
  render.
- Sign out calls `client.reset()`, which drops to a fresh anonymous distinct id. `client.signOut()`
  does the same after capturing the built-in `$sign_out` event.
- After signing in or out, the person, access and flag hooks read again for the new identity on
  their own; the screen does not refetch them.

## Every way a paywall can end or decline

`present()` never rejects. It resolves to a `FlowResult` once the paywall is gone, and a paywall
that could not appear is `failed` with an error code. `lib/paywall-outcome.ts` turns the union into
a decision:

| Result                             | Nimbus does                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `purchased`, `restored`            | Refetches access and captures `paywall_viewed`.                                      |
| `closed`, `finished`               | Captures `paywall_viewed` and stops. The user saw the paywall and left it.           |
| `failed` / `FLOW_NOT_ASSIGNED`     | Opens the Upgrade screen. No paywall is published for the location yet.              |
| `failed` / `FLOW_UNAVAILABLE`      | Opens the Upgrade screen. The paywall never loaded and the server cannot be reached. |
| `failed` / `FLOW_RENDERER_MISSING` | Opens the Upgrade screen. The build does not include the renderer.                   |
| `failed` / anything else           | Opens the Upgrade screen and carries the error message along.                        |

A purchase started inside the paywall that is cancelled or fails does not end it: the paywall shows
the problem and the user can try again or close it.

The point is that Nimbus sells Pro whether or not anyone has configured a paywall. Getting this
wrong is the difference between an integration that degrades and one that dead-ends on a button
that does nothing.

## What to steal for your own app

- [`lib/voidhash.ts`](./lib/voidhash.ts) — one client at module scope, key from the environment,
  `dev` and `enabled` wired sensibly. Copy this verbatim.
- [`components/voidhash-gate.tsx`](./components/voidhash-gate.tsx) — the loading and retry states
  around `useVoidhash()`. `init()` fails when the network does, and `retryInit()` is a one-line fix
  for the user who launched your app in an elevator.
- [`lib/paywall-outcome.ts`](./lib/paywall-outcome.ts) — the `FlowResult` switch. If you take one
  file from this example, take this one.
- [`lib/nimbus.ts`](./lib/nimbus.ts) — slugs and event names in one place, so the app and the
  dashboard cannot drift apart.

## Further reading

- [`@voidhash/react-native` README](../../libraries/react-native/README.md) — options, observer
  mode, error swallowing, analytics batching.
- [Voidhash docs](https://voidhash.com/docs/react-native).
