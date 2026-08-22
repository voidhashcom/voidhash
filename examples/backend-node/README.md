# Nimbus — Node backend

The reference server integration for [`@voidhash/node`](../../libraries/node).

Nimbus is a notes app with a Pro tier: free accounts keep three notes, Pro is
unlimited and can export. That is small enough to read in one sitting and big
enough to need every server-side Voidhash surface — identity, entitlements,
webhooks and analytics. The same service exists in Go, Rust and PHP with the
same routes and status codes; see [`../README.md`](../README.md).

## What it demonstrates

- **Entitlement checks that decide something.** `GET /v1/notes/export` answers
  `402` unless the caller holds the `pro` perk, and the quota on `POST /v1/notes`
  is enforced against the server's own check — never against a flag the client
  sent.
- **A 60-second cache** in front of that check, with single-flight refresh, because
  it sits on every request. The SDK deliberately does not cache for you.
- **Failure that is not a denial.** A 5xx or a transport error means *unknown*,
  so the last known answer is served stale and a network blip never revokes a
  paying customer.
- **Unknown people are free people.** A `distinctId` Voidhash has never seen is a
  free user with no grants, not a 500. `Api/PersonNotFoundError` is mapped; the
  auth tags are not.
- **Idempotent webhooks.** Verify the signature on the raw body, answer `200`
  immediately, then handle the event behind a dedupe set — because a slow
  handler gets delivered twice.
- **Boot-time configuration validation.** No secret key means a one-line error
  and exit 1, not a mystery 500 on the first request.

There is no web framework here. `node:http` plus a 40-line exact-match router
keeps the example about Voidhash, and it makes the webhook's raw-body
requirement the default instead of something you have to opt out of.

## Prerequisites

- Node 18+ (Node 20+ recommended: `pnpm dev` uses `--env-file`).
- A Voidhash project with:
  - a perk with slug **`pro`**,
  - a secret key (Studio → **Project settings → API keys**), and
  - optionally a webhook endpoint, for its signing secret.

## Configure

```sh
cp .env.example .env
```

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `VOIDHASH_SECRET_KEY` | yes | — | `vh_sk_…`. Full project access; server only. |
| `VOIDHASH_WEBHOOK_SECRET` | for the webhook route | — | `whsec_…`. Without it the route answers `503`. |
| `VOIDHASH_BASE_URL` | no | `https://api.voidhash.com` | |
| `VOIDHASH_INGEST_URL` | no | `https://ingest.voidhash.com` | Analytics ingest lives on its own host. |
| `PORT` | no | `8080` | |

> **One credential.** The secret key covers everything this service does,
> analytics included: `voidhash.eventCapture.capture` posts to ingest — its own
> host, hence `VOIDHASH_INGEST_URL` — and authorizes with the same
> `x-secret-key` header as the REST API. No publishable key on a backend.

## Run

```sh
pnpm dev     # tsx watch, reads .env
pnpm start   # no watch, reads the ambient environment
pnpm typecheck
```

From the repository root: `pnpm --filter @voidhash/example-backend-node dev`.

Missing configuration fails loudly:

```
$ pnpm start

VOIDHASH_SECRET_KEY is not set.

Create one in Studio under Project settings → API keys, then either export it:

  export VOIDHASH_SECRET_KEY=vh_sk_...

or copy .env.example to .env and run `pnpm dev`.
```

## Routes

`distinctId` is the same id your app passes to `identify()`. It travels in the
query string here to keep the example short — a real service reads it from a
session, never from the caller.

### `GET /health`

Liveness. Never touches Voidhash, so it stays green during an outage.

```sh
curl localhost:8080/health
```

```json
{ "status": "ok" }
```

### `GET /v1/me?distinctId=…`

The person, their grants, and the attributes the apps display. An id Voidhash
has never seen returns `person: null` and an empty grant list — not an error.

```sh
curl "localhost:8080/v1/me?distinctId=user_new"
```

```json
{
  "attributes": { "notes_created": 0, "plan": "free" },
  "distinctId": "user_new",
  "entitlementsStale": false,
  "grants": [],
  "person": null
}
```

A Pro user:

```json
{
  "attributes": { "notes_created": 1, "plan": "pro" },
  "distinctId": "user_pro",
  "entitlementsStale": false,
  "grants": [
    {
      "expiresAt": "2027-01-01T00:00:00.000Z",
      "perkId": "perk_pro",
      "source": "subscription",
      "sourceId": "sub_1",
      "sourcePersonId": "prsn_pro",
      "status": "active"
    }
  ],
  "person": {
    "personId": "prsn_user_pro",
    "distinctId": "user_pro",
    "email": null,
    "name": null
  }
}
```

`entitlementsStale: true` means Voidhash could not be reached and this is a
cached answer. Ship it to your dashboards; do not act on it as a denial.

### `GET /v1/notes?distinctId=…`

```sh
curl "localhost:8080/v1/notes?distinctId=user_free"
```

```json
{
  "distinctId": "user_free",
  "notes": [],
  "plan": "free",
  "quota": { "limit": 3, "remaining": 3, "used": 0 }
}
```

Pro accounts get `"quota": { "limit": null, "remaining": null, "used": 7 }`.

### `POST /v1/notes`

Creates a note and captures `note_created`.

```sh
curl -X POST localhost:8080/v1/notes \
  -H 'content-type: application/json' \
  -d '{"distinctId":"user_free","body":"Buy milk"}'
```

```json
{
  "note": {
    "body": "Buy milk",
    "createdAt": "2026-08-22T14:12:31.189Z",
    "id": "note_8022a930d6224374"
  },
  "quota": { "limit": 3, "remaining": 2, "used": 1 }
}
```

The fourth note on a free account is `403`. This is the app's cue to present the
`onboarding` paywall:

```json
{
  "error": "note_limit_reached",
  "limit": 3,
  "quota": { "limit": 3, "remaining": 0, "used": 3 }
}
```

### `GET /v1/notes/export?distinctId=…`

Pro only. Captures `export_requested`.

```sh
curl -i "localhost:8080/v1/notes/export?distinctId=user_free"
```

```
HTTP/1.1 402 Payment Required
```
```json
{ "error": "premium_required" }
```

`402`, not `403`: the user *may* have this, they just have not paid for it yet.

```sh
curl "localhost:8080/v1/notes/export?distinctId=user_pro"
```

```json
{
  "distinctId": "user_pro",
  "exportedAt": "2026-08-22T14:12:31.220Z",
  "notes": [
    { "body": "Roadmap", "createdAt": "2026-08-22T14:12:31.189Z", "id": "note_8022a930d6224374" }
  ]
}
```

### `POST /v1/events`

Forwards a client-supplied event. Answers `202` as soon as it is queued —
capture is fire-and-forget, so a slow ingest is never the client's problem.

```sh
curl -X POST localhost:8080/v1/events \
  -H 'content-type: application/json' \
  -d '{"distinctId":"user_free","event":"paywall_viewed","properties":{"location":"onboarding"}}'
```

```json
{ "status": "accepted" }
```

### `POST /webhooks/voidhash`

Verifies the signature, answers `200`, then handles the event out of band. See
below.

### Errors

| Status | Body | When |
| --- | --- | --- |
| `400` | `{ "error": "distinct_id_required" }` | Missing or blank `distinctId`. |
| `400` | `{ "error": "note_body_required" }` | Missing or blank note body. |
| `400` | `{ "error": "invalid_json" }` | Body is not JSON. |
| `402` | `{ "error": "premium_required" }` | Export without the `pro` perk. |
| `403` | `{ "error": "note_limit_reached" }` | Free account already holds 3 notes. |
| `404` | `{ "error": "not_found" }` | No such route. |
| `413` | `{ "error": "payload_too_large" }` | Body over 1 MiB. |
| `503` | `{ "error": "voidhash_unavailable" }` | Voidhash is down and nothing is cached. |
| `503` | `{ "error": "webhook_secret_not_configured" }` | `VOIDHASH_WEBHOOK_SECRET` is unset. |

## Testing the webhook locally

Voidhash signs `${timestamp}.${rawBody}` with HMAC-SHA256 keyed by the endpoint
secret and sends it as `X-Webhook-Signature: v1=<hex>`. **The signature covers
the exact bytes on the wire**, so the body must reach `constructWebhookEvent`
unparsed. With `node:http` that is free. With a framework it is the classic
footgun: a global `express.json()` (or Fastify's default JSON parser) replaces
the body with an object, the route re-serializes it, the bytes differ by a space
somewhere, and every delivery fails verification. If you port this to Express,
mount `express.raw({ type: "application/json" })` on the webhook route.

Sign a request by hand:

```sh
SECRET=whsec_your_secret
BODY='{"type":"purchase.completed","distinctId":"user_pro","purchaseId":"pur_1","occurredAt":"2026-08-22T10:00:00.000Z"}'
TS=$(date +%s)
SIG="v1=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

curl -X POST localhost:8080/webhooks/voidhash \
  -H 'content-type: application/json' \
  -H "X-Webhook-Event: purchase.completed" \
  -H "X-Webhook-Timestamp: $TS" \
  -H "X-Webhook-Signature: $SIG" \
  --data-raw "$BODY"
```

```json
{ "received": true }
```

Run it a second time and the server acknowledges again — but the handler does
nothing:

```
[webhook] purchase.completed for user_pro.
[webhook] purchase.completed purchase.completed:pur_1:2026-08-22T10:00:00.000Z already handled — ignoring the retry.
```

That matters because Voidhash retries anything outside `2xx` — or slower than
30s — after 5m, 30m, 2h and 24h.

Things that should fail, and do:

| Request | Response |
| --- | --- |
| Wrong signature | `400 { "error": "invalid_webhook", "reason": "invalid_signature" }` |
| No signing headers | `400 { "error": "invalid_webhook", "reason": "missing_header" }` |
| Timestamp older than 5 minutes | `400 { "error": "invalid_webhook", "reason": "timestamp_out_of_tolerance" }` |
| Signed body that is not JSON | `400 { "error": "invalid_webhook", "reason": "invalid_payload" }` |

To receive real deliveries, expose the port (`ngrok http 8080`, `cloudflared
tunnel`, …), point a Studio webhook endpoint at
`https://<tunnel>/webhooks/voidhash`, and hit **Test** — that sends `test.ping`.

## What to steal for your own app

| File | Why you would copy it |
| --- | --- |
| [`src/entitlements-cache.ts`](./src/entitlements-cache.ts) | The whole point. TTL, single-flight refresh, serve-stale-on-unknown, and resolving the perk slug to an id exactly once. |
| [`src/voidhash.ts`](./src/voidhash.ts) | `classifyVoidhashFailure` — the three-way split between *not found*, *our key is broken* and *no idea*. Getting this wrong is how outages become churn. |
| [`src/webhooks.ts`](./src/webhooks.ts) | Idempotent handling and a delivery key that survives retries. Move the seen-set to Redis or a unique index before production. |
| [`src/routes/webhook.ts`](./src/routes/webhook.ts) | Raw body → verify → `200` → work. In that order. |
| [`src/config.ts`](./src/config.ts) | Fail at boot, with a message that says what to do. |
| [`src/analytics.ts`](./src/analytics.ts) | Fire-and-forget capture, and why `plan` / `notes_created` are person traits rather than event properties. |

Two things here are example-shaped and should not be copied: notes live in a
`Map` ([`src/notes.ts`](./src/notes.ts)), and `distinctId` arrives in the query
string rather than from an authenticated session.

### Notes on the SDK surface used

- The cache calls `entitlements.getGrantsByDistinctId` rather than
  `entitlements.hasActivePerk`, because `GET /v1/me` renders the grants and the
  boolean is one `.some()` away. If all you need is the boolean,
  `hasActivePerk({ distinctId, perkSlug: "pro" })` is the one-liner — note it
  costs an extra `perks.listPerks` round trip per call unless you pass `perkId`.
- `getGrantsByDistinctId` *fails* on an unknown person while `hasActivePerk`
  returns `false`. That is deliberate: the caller decides whether "never seen"
  and "seen, bought nothing" mean the same thing. Here they do.
- Secret keys are not environment-scoped, so this client reads production and
  store-sandbox grants. Simulated purchases from a debug build are invisible to
  it; to see those, build a second client with
  `headers: { "x-environment": "development" }`.
