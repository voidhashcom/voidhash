# Nimbus (Rust)

Reference backend for the [`voidhash`](../../libraries/rust) crate. Nimbus is a
notes service: free accounts keep three notes, Pro is unlimited and can export.
Every example in [`examples/`](..) implements the same product, so the Node, Go
and PHP services answer the same routes with the same JSON.

Built on axum and tokio. Notes live in a `RwLock<HashMap<…>>` — this is an SDK
example, not a database tutorial.

## What it demonstrates

| Thing                                                                       | Where                                                                                    |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Client construction and boot-time config validation                         | [`src/main.rs`](src/main.rs)                                                             |
| Entitlement checks behind a 60s cache                                       | [`src/entitlements.rs`](src/entitlements.rs)                                             |
| Treating transport and `5xx` failures as _unknown_, never as a denial       | [`src/entitlements.rs`](src/entitlements.rs)                                             |
| Signature verification over raw bytes, with a dedupe set                    | [`src/webhooks.rs`](src/webhooks.rs), [`src/routes/webhooks.rs`](src/routes/webhooks.rs) |
| Analytics capture, best-effort on writes and strict on the forwarding route | [`src/analytics.rs`](src/analytics.rs)                                                   |
| Branching on `voidhash::Error` variants rather than on message text         | [`src/error.rs`](src/error.rs)                                                           |
| A payment source's provider endpoint, every operation, with unit tests      | [`src/acme_pay.rs`](src/acme_pay.rs)                                                     |
| Pushing a provider's payment as a charge and a subscription state           | [`src/routes/acme_pay.rs`](src/routes/acme_pay.rs)                                       |

## Prerequisites

- Rust 1.85 or newer (edition 2021, `let`-else, async traits in `impl` blocks).
- A Voidhash project with:
  - a perk with slug **`pro`**,
  - products **`pro-monthly`**, **`pro-annual`**, **`pro-lifetime`** granting it,
  - a **secret key** (`vh_sk_…`) from Project settings → API keys; staging uses
    a test secret key (`vh_sk_test_…`).

The secret key grants full project access — including analytics capture. Keep
it on the server; the apps use a publishable key instead.

## Configure

```sh
cp .env.example .env
$EDITOR .env
```

| Variable                       | Required                      | Default                       |
| ------------------------------ | ----------------------------- | ----------------------------- |
| `VOIDHASH_SECRET_KEY`          | yes                           | —                             |
| `VOIDHASH_WEBHOOK_SECRET`      | for `/webhooks/voidhash`      | —                             |
| `ACME_PAY_SIGNING_SECRET`      | for `/voidhash/provider/acme` | —                             |
| `ACME_PAY_PAYMENT_PROVIDER_ID` | for `/webhooks/acme-pay`      | —                             |
| `VOIDHASH_BASE_URL`            | no                            | `https://api.voidhash.com`    |
| `VOIDHASH_INGEST_URL`          | no                            | `https://ingest.voidhash.com` |
| `PORT`                         | no                            | `8080`                        |

`VOIDHASH_BASE_URL` is the management API root — the SDK appends `/api/v1/…`
itself. Analytics ingestion is a separate origin with its own variable.

Starting without `VOIDHASH_SECRET_KEY` exits `1` with an explanation rather
than failing on the first request:

```
$ cargo run
nimbus: VOIDHASH_SECRET_KEY is not set.
Create one in Studio under Project settings -> API keys (it starts with "vh_sk_") and export it before starting the server:

    export VOIDHASH_SECRET_KEY=vh_sk_...
```

## Run

There is no `.env` loader in the dependency list, so export the file yourself:

```sh
set -a && . ./.env && set +a
cargo run
```

```
INFO nimbus listening address=0.0.0.0:8080 base_url=https://api.voidhash.com
```

`RUST_LOG` works as usual — `RUST_LOG=debug cargo run` for the noisy version.

## Routes

Every example below assumes `BASE=http://localhost:8080` and a distinct id that
exists in your project. Responses are real output, trimmed of nothing.

### `GET /health`

Liveness. Never touches Voidhash, so a Voidhash incident cannot pull your
service out of a load balancer.

```sh
curl -s $BASE/health
```

```json
{ "status": "ok" }
```

### `GET /v1/me?distinctId=…`

The person record plus their entitlement grants.

```sh
curl -s "$BASE/v1/me?distinctId=pro-user"
```

```json
{
  "distinctId": "pro-user",
  "known": true,
  "pro": true,
  "person": {
    "personId": "person_01J8PRO",
    "email": "grace@example.com",
    "name": "Grace"
  },
  "grants": [
    {
      "perkId": "perk_01J8PRO",
      "perkSlug": "pro",
      "source": "subscription",
      "sourceId": "sub_01J8ABC",
      "expiresAt": "2026-09-22T09:41:00.000Z"
    }
  ],
  "freshness": "fresh"
}
```

A distinct id Voidhash has never seen is a free user, not a `404`:

```sh
curl -s "$BASE/v1/me?distinctId=ghost"
```

```json
{
  "distinctId": "ghost",
  "known": false,
  "pro": false,
  "person": null,
  "grants": [],
  "freshness": "fresh"
}
```

`freshness` is not part of the product; it exists so the cache is visible from
`curl`. Repeat the request inside 60s and it flips to `"cached"`.

### `GET /v1/notes?distinctId=…`

The caller's notes and their remaining free quota. `limit` and `remaining` are
`null` for Pro, which is unlimited.

```sh
curl -s "$BASE/v1/notes?distinctId=user-123"
```

```json
{
  "distinctId": "user-123",
  "pro": false,
  "limit": 3,
  "remaining": 2,
  "freshness": "cached",
  "notes": [
    {
      "id": "note_1",
      "title": "Ship the Rust example",
      "body": "axum + the voidhash crate",
      "createdAt": "2026-08-22T14:14:02.985446+00:00"
    }
  ]
}
```

### `POST /v1/notes`

Creates a note and captures `note_created`.

```sh
curl -s -X POST $BASE/v1/notes \
  -H 'content-type: application/json' \
  -d '{"distinctId":"user-123","title":"Ship the Rust example","body":"axum + the voidhash crate"}'
```

```json
{
  "note": {
    "id": "note_1",
    "title": "Ship the Rust example",
    "body": "axum + the voidhash crate",
    "createdAt": "2026-08-22T14:14:02.985446+00:00"
  },
  "pro": false,
  "limit": 3,
  "remaining": 2
}
```

The fourth note on a free account is `403`:

```json
{
  "error": "note_limit_reached",
  "message": "free accounts are limited to 3 notes; upgrade to Nimbus Pro"
}
```

### `GET /v1/notes/export?distinctId=…`

Pro only. Captures `export_requested`.

```sh
curl -s "$BASE/v1/notes/export?distinctId=pro-user"
```

```json
{
  "distinctId": "pro-user",
  "exportedAt": "2026-08-22T14:14:03.546543+00:00",
  "count": 1,
  "notes": [
    {
      "id": "note_4",
      "title": "Quarterly plan",
      "body": "unlimited",
      "createdAt": "2026-08-22T14:14:03.439748+00:00"
    }
  ]
}
```

Without the `pro` perk it is `402`, which is the code the app maps to the
`onboarding` paywall:

```json
{
  "error": "premium_required",
  "message": "export requires an active \"pro\" entitlement"
}
```

### `POST /v1/events`

Forwards a client-supplied analytics event. Nimbus's mobile apps capture
`paywall_viewed` and `checkout_started` through the client SDK directly; this
route is for the surfaces that cannot, and is where you would attach
server-side truth a client must not be trusted to supply.

```sh
curl -s -X POST $BASE/v1/events \
  -H 'content-type: application/json' \
  -d '{"distinctId":"user-123","event":"paywall_viewed","properties":{"location":"onboarding"}}'
```

```json
{
  "status": "sent",
  "event": "paywall_viewed",
  "distinctId": "user-123"
}
```

Ingestion failures are `502 analytics_rejected` / `analytics_unreachable` —
unlike the note routes, forwarding is this route's whole job, so a dropped
event is a failed request.

### `POST /webhooks/voidhash`

Verifies the signature, acknowledges, then handles the event out of band.

```json
{ "received": true, "duplicate": false }
```

Unverifiable deliveries are `400 invalid_signature`; a delivery that arrives
twice is `200` with `"duplicate": true` and no second handler run.

### `POST /webhooks/acme-pay`

Acme Pay is a made-up payment provider Voidhash does not integrate natively;
Nimbus reports its payments as the payment source `acme` (create it in Studio
under Payment sources, and set `ACME_PAY_PAYMENT_PROVIDER_ID` to its payment
provider id). This route takes Acme Pay's `subscription.paid` event and pushes
two records with `client.payment_source(...)`: the charge for the period, and
the subscription's new state. The event's `distinctId` is the buyer's Voidhash
distinct id, which your server stores in the checkout's metadata when it
creates the checkout at Acme Pay.

```sh
curl -s -X POST $BASE/webhooks/acme-pay \
  -H 'content-type: application/json' \
  -d '{"transactionId":"txn_2","subscriptionId":"sub_1","distinctId":"pro-user","customerId":"ctm_1","productKey":"pro-monthly","amount":999,"currency":"EUR","fee":59,"paidAt":"2026-11-01T00:00:04Z","periodStart":"2026-11-01T00:00:00Z","periodEnd":"2026-12-01T00:00:00Z"}'
```

The answer holds what Voidhash recorded for each (`transaction`,
`subscription`). Both records are keyed by Acme Pay's ids, so a retried
delivery sends the same records again and nothing is counted twice. A real
provider signs its webhooks; verify them as its documentation says first.

### `POST /voidhash/provider/acme`

The provider endpoint Voidhash calls for the `acme` source, mounted when
`ACME_PAY_SIGNING_SECRET` holds the source's signing secret. Set its URL on
the source in Studio. [`src/acme_pay.rs`](src/acme_pay.rs) implements every
operation against an in-memory Acme Pay seeded with Nimbus's three products and
one subscriber:

| Operation             | What Acme Pay does                                          |
| --------------------- | ----------------------------------------------------------- |
| `catalog.list`        | lists the products, 100 per page                            |
| `history.list`        | lists subscriptions or transactions created before `before` |
| `subscription.get`    | looks a subscription up                                     |
| `subscription.cancel` | stops renewal, or cancels at once                           |
| `transaction.refund`  | refunds part or all of what is left of a charge             |

The SDK verifies the signature, answers `describe`, and checks every result
before replying. Sign a request yourself to try it:

```sh
SECRET=vhps_...   # the value of ACME_PAY_SIGNING_SECRET
BODY='{"protocolVersion":1,"id":"preq_1","source":"acme","environment":"test","operation":"describe","input":{}}'
TS=$(date +%s)
SIG="v1=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d' ' -f1)"

curl -s -X POST $BASE/voidhash/provider/acme \
  -H "x-voidhash-timestamp: $TS" \
  -H "x-voidhash-signature: $SIG" \
  -d "$BODY"
```

```json
{
  "id": "preq_1",
  "result": {
    "protocolVersion": 1,
    "source": "acme",
    "operations": [
      "catalog.list",
      "describe",
      "history.list",
      "subscription.cancel",
      "subscription.get",
      "transaction.refund"
    ],
    "sdk": { "name": "voidhash-rust", "version": "0.1.0" }
  }
}
```

`cargo test` sends signed requests through the same handler with
`ProviderHandler::test`; see the tests at the bottom of `src/acme_pay.rs`.

### Errors

Every failure uses the same envelope:

```json
{ "error": "note_limit_reached", "message": "…" }
```

| Status | `error`                                           | When                                     |
| ------ | ------------------------------------------------- | ---------------------------------------- |
| `400`  | `missing_distinct_id`                             | no usable `?distinctId=`                 |
| `400`  | `invalid_body`                                    | malformed or incomplete JSON             |
| `400`  | `invalid_signature` / `missing_signature_headers` | webhook verification                     |
| `402`  | `premium_required`                                | export without the `pro` perk            |
| `403`  | `note_limit_reached`                              | fourth note on a free account            |
| `429`  | `rate_limited`                                    | Voidhash rate limit                      |
| `500`  | `voidhash_auth_failed`                            | your secret key was rejected             |
| `502`  | `voidhash_unreachable` / `voidhash_unavailable`   | Voidhash is down                         |
| `502`  | `analytics_rejected` / `analytics_unreachable`    | ingestion refused the event              |
| `503`  | `entitlements_unavailable`                        | Voidhash is down _and_ nothing is cached |

## Testing the webhook locally

Point a tunnel at the route (`ngrok http 8080`), register the URL in Studio
under Project settings → Webhooks, subscribe it to the `subscription.*` and
`purchase.*` events, and copy the signing secret into
`VOIDHASH_WEBHOOK_SECRET`. **Test endpoint** in Studio then sends a signed
delivery.

To exercise it with no tunnel, sign a body yourself. Voidhash signs
`${timestamp}.${rawBody}` with HMAC-SHA256 and sends `v1=<lowercase hex>`:

```sh
SECRET=whsec_test
BODY='{"type":"subscription.created","distinctId":"user-123","subscriptionId":"sub_1","occurredAt":"2026-08-22T14:00:00.000Z","personId":"p_1","productId":"prod_1","productSlug":"pro-monthly","projectId":"proj_1","provider":"stripe","providerProductId":"price_1","status":"active"}'
TS=$(date +%s)
SIG="v1=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d' ' -f1)"

curl -s -X POST $BASE/webhooks/voidhash \
  -H "x-webhook-event: subscription.created" \
  -H "x-webhook-signature: $SIG" \
  -H "x-webhook-timestamp: $TS" \
  -H 'content-type: application/json' \
  -d "$BODY"
```

```json
{ "received": true, "duplicate": false }
```

Re-sign the same body with a fresh timestamp — which is exactly what a retry
looks like — and the second call is deduplicated:

```json
{ "received": true, "duplicate": true }
```

```
INFO duplicate webhook delivery, already handled key="subscription.created:sub_1:2026-08-22T14:00:00.000Z"
```

Append a byte to `$BODY` without re-signing and you get
`400 invalid_signature`. The default timestamp tolerance is five minutes, so a
`$TS` from yesterday is rejected too.

## The three things this gets right

The routes are the boring part. These are not.

### 1. A short cache in front of the access check

Every gated route resolves entitlements, so a round trip per request is a
latency floor you do not need. [`EntitlementCache`](src/entitlements.rs) holds
answers for 60s — short enough that the webhook-driven `invalidate` is a
nicety rather than a correctness requirement.

### 2. Failure is not denial

A transport error or a `5xx` means _unknown_. The cached answer is served past
its TTL and marked `"freshness": "stale"`:

```json
{
  "distinctId": "pro-user",
  "known": true,
  "pro": true,
  "person": { "personId": "person_01J8PRO", "email": "grace@example.com", "name": "Grace" },
  "grants": [
    {
      "perkId": "perk_01J8PRO",
      "perkSlug": "pro",
      "source": "subscription",
      "sourceId": "sub_01J8ABC",
      "expiresAt": "2026-09-22T09:41:00.000Z"
    }
  ],
  "freshness": "stale"
}
```

Revoking a paying customer because a network hop flapped is a support ticket;
serving a minute of stale truth is not. When Voidhash is unreachable _and_ the
caller has never been resolved by this process there is nothing to serve, and
the route answers `503 entitlements_unavailable` rather than quietly
downgrading them to the free tier.

A `404` is a different thing: it is a definite "no such person", so it is
cached like any other answer and the caller is simply free.

### 3. Idempotent webhook handling

Two details, both easy to miss:

- **The body is `axum::body::Bytes`, not `Json<T>`.** The signature covers the
  exact bytes that were sent. Deserializing first and re-serializing to verify
  changes key order, number formatting and whitespace, and every delivery
  fails. See the comment on
  [`routes::webhooks::receive`](src/routes/webhooks.rs).
- **The dedupe key is derived from the payload, not the signature.** A retry is
  re-signed with a fresh timestamp, so the signature differs between attempts;
  the payload does not. `delivery_key` uses the subject id plus `occurredAt`,
  falling back to the whole body for event shapes it does not know yet.

The key is claimed _before_ the handler runs, so two concurrent redeliveries
cannot both get through, and the response is sent _before_ handling, so a slow
handler does not turn into another retry.

## What to steal for your own app

- **[`src/entitlements.rs`](src/entitlements.rs)** — the whole file. The cache,
  the stale-on-unknown policy and the `404`-is-free branch are the parts you
  would otherwise get wrong, and they are independent of axum.
- **[`src/error.rs`](src/error.rs)** — `From<voidhash::Error> for ApiError`.
  Branch on `Error::Api { status, code, .. }` and `error.is_not_found()`; never
  on the text of `error.to_string()`.
- **[`src/routes/webhooks.rs`](src/routes/webhooks.rs)** — the `Bytes`
  extractor, verify → claim → acknowledge → handle ordering.
- **[`src/webhooks.rs`](src/webhooks.rs)** — `delivery_key`. Replace
  `DedupeSet` with a table and a unique index; the key itself survives.
- **[`src/analytics.rs`](src/analytics.rs)** — the best-effort vs strict split
  (see below).
- **[`src/main.rs`](src/main.rs)** — `Config::from_env`. Validate at boot, exit
  with a sentence a human can act on.

What _not_ to steal: `NoteStore` (use a database) and the fact that
`distinctId` arrives in the query string. A real service resolves the distinct
id from the caller's access token and never from user-controlled input.

## A note on analytics capture

[`src/analytics.rs`](src/analytics.rs) wraps the SDK. Both calls authenticate
with the project's secret key — capture needs no second credential:

- `client.event_capture().capture()` posts to ingest, which lives on its own
  origin (`VOIDHASH_INGEST_URL`) and reads the secret key from `x-secret-key`.
  Management calls send the same key as an `Authorization: Bearer` header.
- `client.persons().set_attributes()` is a server-to-server write. Traits
  describe the person and persist, so `plan` and `notes_created` go there
  rather than onto every event's properties.

What that module owns is the example's policy — best-effort on write paths,
strict on `POST /v1/events` where forwarding _is_ the request — not the wire
format, which the SDK owns.

## Layout

```
src/
  main.rs            config, client construction, graceful shutdown
  state.rs           AppState
  analytics.rs       capture + person attributes over the SDK
  error.rs           ApiError, the voidhash::Error mapping, IntoResponse
  entitlements.rs    the 60s read-through cache and the pro check
  notes.rs           in-memory note store and the free quota
  webhooks.rs        verification, dedupe set, event handling
  acme_pay.rs        in-memory payment provider and its provider endpoint
  routes/
    mod.rs           router and the DistinctId extractor
    health.rs        GET  /health
    me.rs            GET  /v1/me
    notes.rs         GET/POST /v1/notes, GET /v1/notes/export
    events.rs        POST /v1/events
    webhooks.rs      POST /webhooks/voidhash
    acme_pay.rs      POST /webhooks/acme-pay
```

## Development

```sh
cargo check
cargo test
cargo clippy --all-targets -- -D warnings
cargo fmt
```

The crate depends on the SDK by path so it builds inside this repository. In
your own project use the published crate:

```toml
[dependencies]
voidhash = "0.1"
```

The SDK's `build.rs` runs [progenitor](https://github.com/oxidecomputer/progenitor)
codegen against the committed OpenAPI documents, so the first build takes a
while. Later builds are cached.

## License

MIT — see [LICENSE.md](LICENSE.md).
