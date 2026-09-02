# Voidhash examples

Runnable reference integrations, one per SDK. Every example implements the same
small product — **Nimbus**, a notes app with a Pro tier — so you can read the one
in your language and still recognise the shape of the others.

| Example                                  | SDK                                                   | What it is               |
| ---------------------------------------- | ----------------------------------------------------- | ------------------------ |
| [`backend-node`](./backend-node)         | [`@voidhash/node`](../libraries/node)                 | Node HTTP service        |
| [`backend-go`](./backend-go)             | [`voidhash-go`](../libraries/go)                      | Go HTTP service          |
| [`backend-rust`](./backend-rust)         | [`voidhash`](../libraries/rust)                       | Rust (axum) HTTP service |
| [`backend-php`](./backend-php)           | [`voidhash/voidhash-php`](../libraries/php)           | PHP HTTP service         |
| [`app-react-native`](./app-react-native) | [`@voidhash/react-native`](../libraries/react-native) | Expo app                 |
| [`app-ios`](./app-ios)                   | [`@voidhash/ios`](../libraries/ios)                   | SwiftUI app              |
| [`app-android`](./app-android)           | [`@voidhash/android`](../libraries/android)           | Jetpack Compose app      |

Two other directories predate this suite and are not part of it:
[`mimic-example`](./mimic-example) demos the Mimic collaboration SDK, and
[`react-native-example`](./react-native-example) is the SDK team's internal
debugging harness — it exercises edge cases rather than showing an integration.

## The Nimbus product

Nimbus lets you write notes. Free accounts keep **3**; Pro is unlimited and can
export. That is the whole business model, and it is enough to exercise every
core SDK surface:

- Free users hit a limit → somewhere to show a **paywall**.
- Pro is a thing you buy → **products**, **purchases**, **restore**.
- The server must not take the client's word for it → **entitlement checks** and
  **webhooks**.
- Someone has to be the customer → **identity**.
- Somebody wants to know if any of this works → **analytics** and **feature flags**.

## Shared vocabulary

Every example uses these exact names, so a dashboard configured for one works
for all of them.

| Concept           | Value                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| Perk slug         | `pro`                                                                    |
| Product slugs     | `pro-monthly`, `pro-annual`, `pro-lifetime`                              |
| Paywall location  | `onboarding`                                                             |
| Feature flag      | `nimbus-new-onboarding`                                                  |
| Person attributes | `plan`, `notes_created`                                                  |
| Analytics events  | `note_created`, `export_requested`, `paywall_viewed`, `checkout_started` |
| Free note limit   | 3                                                                        |

## What the backends do

`backend-node`, `backend-go`, `backend-rust` and `backend-php` are the same
service in four languages — same routes, same status codes, same JSON:

| Route                               | Behaviour                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /health`                       | Liveness. Never touches Voidhash.                                                                        |
| `GET /v1/me?distinctId=…`           | Person plus entitlement grants. A distinct id Voidhash has never seen is a free user, not an error.      |
| `GET /v1/notes?distinctId=…`        | The caller's notes and their remaining free quota.                                                       |
| `POST /v1/notes`                    | Creates a note. Rejects with `403 note_limit_reached` once a free user holds 3. Captures `note_created`. |
| `GET /v1/notes/export?distinctId=…` | Pro only. Rejects with `402 premium_required`. Captures `export_requested`.                              |
| `POST /v1/events`                   | Forwards a client-supplied analytics event to Voidhash.                                                  |
| `POST /webhooks/voidhash`           | Verifies the signature, acknowledges immediately, then handles the event.                                |

Notes live in memory: this is an SDK example, not a database tutorial. Each
service also shows the three things that are easy to get wrong in production:

1. **A short entitlement cache** (60s) in front of the access check, because it
   sits on a hot path.
2. **Failure that is not a denial.** A transport error or a 5xx means _unknown_,
   so the cached answer is served stale rather than revoking a paying customer.
3. **Idempotent webhook handling**, because a slow handler gets delivered twice.

### Configuration

| Variable                   | Required                 | Default                       |
| -------------------------- | ------------------------ | ----------------------------- |
| `VOIDHASH_SECRET_KEY`      | yes                      | —                             |
| `VOIDHASH_WEBHOOK_SECRET`  | for `/webhooks/voidhash` | —                             |
| `VOIDHASH_BASE_URL`        | no                       | `https://api.voidhash.com`    |
| `PORT`                     | no                       | `8080`                        |
| `VOIDHASH_PUBLISHABLE_KEY` | for analytics capture    | —                             |
| `VOIDHASH_INGEST_URL`      | no                       | `https://ingest.voidhash.com` |

Leave the last two unset and the service still runs: capture no-ops after one
warning at boot, and every other route behaves normally.

### A note on server-side analytics

The four backends capture events through their SDK's `capture` helper. Each
keeps one small analytics module, but only to hold the example's own policy —
capture is best-effort on write paths and strict on `POST /v1/events` — not to
build the request.

Two credentials are in play, which is worth knowing before you copy any of it:

- **Capture** posts to ingest, which authenticates on the **publishable** key
  carried as `token` in the body, and lives on its own origin. That is why
  capture needs two variables the rest of the service does not.
- **Person attributes** are a server-to-server write on the **secret** key.
  Traits describe the person and persist, so `plan` and `notes_created` are
  written there rather than repeated on every event's properties.

## What the apps do

`app-react-native`, `app-ios` and `app-android` are the same three screens:

- **Notes** — the note list, the free-quota banner, and an Export button that
  presents the `onboarding` paywall when the user is not Pro.
- **Upgrade** — the app-owned fallback: products from the SDK, buy, restore. This
  is what the user sees when no paywall is published for the location, which is
  the state every new project starts in.
- **Account** — sign in (`identify`), person attributes, entitlement grants, the
  `nimbus-new-onboarding` flag, and sign out (`reset`).

All three run in **development mode** in debug builds, so you can complete a
purchase on a simulator with no App Store Connect or Play Console setup.

## Getting a key

Create a project in [Studio](https://voidhash.com), then take the
**publishable key** (`vh_pk_…`) for the apps and a **secret key** (`vh_sk_…`,
Project settings → API keys) for the backends. The secret key grants full
project access — keep it on your server.
