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
to exercise edge cases: raw JSON dumps, WebView smoke screens, StoreKit corner cases. It is a useful
place to look when something is broken, and a bad place to look when you are starting.

This app is the opposite. Every screen is something you would ship, and every SDK call is one your
own app will make.

## What it demonstrates

| Surface                                                                | Where                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Provider, loading state, **failure state with retry**                  | [`components/voidhash-gate.tsx`](./components/voidhash-gate.tsx) |
| Entitlement check, including the stale-while-offline answer            | [`app/(tabs)/index.tsx`](<./app/(tabs)/index.tsx>)               |
| Presenting a hosted paywall and handling **every** way it can decline  | [`lib/paywall-outcome.ts`](./lib/paywall-outcome.ts)             |
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
  key** (`vh_pk_…`) from Project settings → API keys. Publishable keys are meant to ship inside
  apps; the secret key (`vh_sk_…`) belongs on a server and never in this repo.

## Configure

```sh
cp .env.example .env
```

| Variable                               | Required | Purpose                                     |
| -------------------------------------- | -------- | ------------------------------------------- |
| `EXPO_PUBLIC_VOIDHASH_PUBLISHABLE_KEY` | yes      | Your `vh_pk_…` key.                         |
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

## Development mode

`lib/voidhash.ts` passes `dev: true`. In debug builds that replaces the real store adapter with a
fake one: `getProducts()` returns the products configured in Studio priced from your project's
development configuration, and buying one opens a plain confirmation alert instead of a StoreKit or
Play Billing sheet. Confirm it and a real transaction is recorded against your project, the `pro`
perk is granted, and the Notes screen unlocks.

That means the full purchase → entitlement → unlock loop works on a simulator with no App Store
Connect and no Play Console setup. The SDK ignores `dev` unless `__DEV__` is true, so a release
build always talks to the real store.

## The screens

### Notes — `app/(tabs)/index.tsx`

The list, the quota banner and the two actions that touch Voidhash.

- `voidhash.useHasPerk("pro")` answers whether the user is Pro. It also reports `isStale`, which is
  `true` when the refresh failed and the answer came from the cached snapshot. Nimbus shows a badge
  instead of revoking access — a paying customer on a train should keep their features.
- Creating a note captures `note_created` and writes the `notes_created` person attribute.
- Export captures `export_requested`. Pro exports; everyone else gets the paywall.
- `voidhash.usePaywallByLocation("onboarding", …)` preloads the paywall on mount and again on every
  app foreground, so `show()` is usually instant. Its callbacks (`onPurchase`, `onRestore`,
  `onError`, `onPreloadError`) are where the app reacts to what happened inside the paywall.

### Upgrade — `app/(tabs)/upgrade.tsx`

The app-owned fallback, and the screen a brand-new project sees before a paywall is published.

- `voidhash.useProducts()` wraps `getProducts()`. Nimbus orders the three known slugs itself and
  appends anything else the store returned.
- `voidhash.usePurchase()` runs the purchase. Its result is a `Result`, and its success value is a
  `PurchaseOutcome`: `completed`, `cancelled`, `pending` or `disabled`. Only the first unlocks
  anything, and none of them is an error — a customer who dismisses the sheet did not fail.
- `client.restorePurchases()` reconciles past transactions and refreshes the person.
- `checkout_started` is captured before the store sheet opens.

### Account — `app/(tabs)/account.tsx`

- `client.identify(externalUserId, { email, name })` attaches the anonymous person to your user.
  The id comes from `lib/fake-auth.ts`, standing in for your auth system: it must be stable and hard
  to guess, never an email and never a sequential number.
- `client.setPersonAttributes({ plan, notes_created })` writes your own data onto that person. The
  update rides the analytics queue, so the screen calls `client.flush()` when it wants it delivered
  now.
- `useCurrentPerson()` renders the person snapshot, including `entitlements.grants` — the grants are
  the answer behind `useHasPerk`, shown raw so you can see what the check is reading.
- `useFeatureFlags(["nimbus-new-onboarding"])` evaluates the flag for the current person. Note that
  the key array lives at module scope: the hook keys its fetch on that array's identity, and a fresh
  literal every render refetches every render.
- Sign out calls `client.reset()`, which drops to a fresh anonymous distinct id. `client.signOut()`
  does the same after capturing the built-in `$sign_out` event.

## Every way a paywall can decline

`show()` never rejects. It resolves to a `ShowPaywallResult`, and all but one status means "show
your own screen". `lib/paywall-outcome.ts` turns the union into a decision:

| Status                  | Nimbus does                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `shown`                 | Captures `paywall_viewed` and stops. The hosted paywall owns the flow from here.                        |
| `not_assigned`          | Opens the Upgrade screen. **This is the default state of a new project** — no paywall is published yet. |
| `disabled`              | Opens the Upgrade screen. The client was built with `enabled: false`.                                   |
| `native_unavailable`    | Opens the Upgrade screen. No native presenter on this platform.                                         |
| `not_initialized`       | Opens the Upgrade screen. The SDK is still starting.                                                    |
| `initialization_failed` | Opens the Upgrade screen and carries the error along.                                                   |
| `failed`                | Opens the Upgrade screen and carries the error along.                                                   |

The point is that Nimbus sells Pro whether or not anyone has configured a paywall. Getting this
wrong is the difference between an integration that degrades and one that dead-ends on a button
that does nothing.

## What to steal for your own app

- [`lib/voidhash.ts`](./lib/voidhash.ts) — one client at module scope, key from the environment,
  `dev` and `enabled` wired sensibly. Copy this verbatim.
- [`components/voidhash-gate.tsx`](./components/voidhash-gate.tsx) — the loading and retry states
  around `useVoidhash()`. `init()` fails when the network does, and `retryInit()` is a one-line fix
  for the user who launched your app in an elevator.
- [`lib/paywall-outcome.ts`](./lib/paywall-outcome.ts) — the `ShowPaywallResult` switch. If you take
  one file from this example, take this one.
- [`lib/nimbus.ts`](./lib/nimbus.ts) — slugs and event names in one place, so the app and the
  dashboard cannot drift apart.

## Further reading

- [`@voidhash/react-native` README](../../libraries/react-native/README.md) — options, observer
  mode, error swallowing, analytics batching.
- [Voidhash docs](https://voidhash.com/docs/react-native).
