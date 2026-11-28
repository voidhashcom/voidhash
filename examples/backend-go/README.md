# Nimbus — Go backend

The reference server-side integration for the [Voidhash Go SDK](../../libraries/go).

Nimbus is a notes app with a Pro tier: free accounts keep three notes, Pro is
unlimited and can export. Every example in [`examples/`](../) implements that
same product, so the Go service, the Node service and the mobile apps all speak
to one Voidhash project.

Standard library plus the SDK. No web framework, no database — notes live in a
mutex-guarded map, because the interesting part is everything around them.

## What it demonstrates

- **Entitlement checks the client cannot forge.** The free note limit and the
  Pro-only export are enforced here, not in the app.
- **A 60-second entitlement cache**, because the access check sits on every
  write path and one API call per request is not a design.
- **Failure that is not a denial.** A transport error or a 5xx means the state
  is _unknown_. The cached answer is served stale rather than revoking a paying
  customer because DNS blipped.
- **Idempotent webhook handling.** A handler slower than the 30-second delivery
  timeout gets delivered twice; a dedupe set makes the second one a no-op.
- **Unknown people are free people.** A distinct id Voidhash has never seen is
  a 404 from the API and a `200 {"known": false}` from this service.
- **Analytics as a side effect that cannot fail the request.** A dropped
  `note_created` is better than a lost note.
- **Payments from a provider Voidhash does not integrate.** Nimbus also sells
  Pro through its own billing provider (an in-memory stand-in here). Its
  webhooks push charges and subscription states to Voidhash, and a provider
  endpoint lets Voidhash import its catalog and history, and refresh, cancel
  and refund subscriptions.

## Prerequisites

- Go 1.22 or newer (`http.ServeMux` method patterns).
- A Voidhash project with:
  - a perk with slug `pro`,
  - products `pro-monthly`, `pro-annual`, `pro-lifetime` associated with it,
  - optionally a webhook endpoint pointing at `/webhooks/voidhash`.

Create the project in [Studio](https://voidhash.com); the secret key is under
**Project settings → API keys**. Use a test secret key (`vh_sk_test_…`) for
staging.

## Configure

```sh
cp .env.example .env
```

| Variable                     | Required                 | Default                       |
| ---------------------------- | ------------------------ | ----------------------------- |
| `VOIDHASH_SECRET_KEY`        | yes                      | —                             |
| `VOIDHASH_WEBHOOK_SECRET`    | for `/webhooks/voidhash` | —                             |
| `VOIDHASH_BASE_URL`          | no                       | `https://api.voidhash.com`    |
| `VOIDHASH_INGEST_URL`        | no                       | `https://ingest.voidhash.com` |
| `PORT`                       | no                       | `8080`                        |
| `VOIDHASH_PAYMENT_SOURCE`    | no                       | `nimbus-billing`              |
| `VOIDHASH_PAYMENT_SOURCE_ID` | for `/webhooks/billing`  | —                             |
| `VOIDHASH_PROVIDER_SECRET`   | for `/voidhash/provider` | —                             |
| `BILLING_WEBHOOK_SECRET`     | for `/webhooks/billing`  | —                             |

The server refuses to start without `VOIDHASH_SECRET_KEY` and tells you where
to find one. That one key covers everything, analytics capture included, and
names the project too: the SDK reads the key's project from Voidhash on its
first call. The rest are warnings at boot, not failures: the service runs fine
with webhooks switched off.

## Run

```sh
export $(grep -v '^#' .env | xargs)
go run .
```

```
{"time":"…","level":"INFO","msg":"nimbus listening","addr":":8080","baseUrl":"https://api.voidhash.com"}
```

```sh
go build ./...
go vet ./...
```

## Routes

| Route                               | Behaviour                                                          |
| ----------------------------------- | ------------------------------------------------------------------ |
| `GET /health`                       | Liveness. Never touches Voidhash.                                  |
| `GET /v1/me?distinctId=…`           | Person plus entitlement grants.                                    |
| `GET /v1/notes?distinctId=…`        | The caller's notes and their remaining free quota.                 |
| `POST /v1/notes`                    | Creates a note. `403 note_limit_reached` once a free user holds 3. |
| `GET /v1/notes/export?distinctId=…` | Pro only. `402 premium_required` otherwise.                        |
| `POST /v1/events`                   | Forwards a client-supplied analytics event.                        |
| `POST /v1/checkout`                 | Opens a checkout at the billing provider for the buyer.            |
| `POST /webhooks/voidhash`           | Verifies the signature, acknowledges, then handles.                |
| `POST /voidhash/provider`           | The billing provider's endpoint, which Voidhash calls.             |
| `POST /webhooks/billing`            | Billing provider events, pushed to Voidhash as payments.           |

Errors are always `{"error": "<stable_code>", "message": "<prose>"}`. Branch on
`error`, never on `message`. Denials that a purchase would fix also carry
`"paywall": {"location": "onboarding"}`, so the client knows what to present.

Beyond the two codes above: `400 invalid_request`, `404 not_found` /
`product_not_found`, `502 upstream_error` / `capture_failed`,
`503 entitlements_unavailable` when Voidhash is unreachable and nothing is
cached, and `500 perk_not_configured` when the project has no `pro` perk.

## Walkthrough

### Health

```sh
curl -s localhost:8080/health
```

```json
{ "status": "ok", "service": "nimbus-backend-go", "uptimeSeconds": 12 }
```

### Who is this?

```sh
curl -s "localhost:8080/v1/me?distinctId=user-123"
```

```json
{
  "distinctId": "user-123",
  "known": true,
  "person": {
    "createdAt": "2026-08-01T09:12:44.000Z",
    "distinctId": "user-123",
    "email": "ada@example.com",
    "id": "person_01HZAB2K",
    "isIdentified": true,
    "name": "Ada Lovelace",
    "projectId": "proj_01HZNIMBUS"
  },
  "attributes": { "plan": "pro", "notes_created": 0 },
  "entitlements": {
    "pro": true,
    "grants": [
      {
        "expiresAt": "2027-03-01T00:00:00Z",
        "perkId": "perk_01HZPRO",
        "perkSlug": "pro",
        "source": "subscription",
        "sourceId": "sub_01HZ9",
        "sourcePersonId": "person_01HZAB2K"
      }
    ],
    "resolvedAt": "2026-08-22T16:17:27.049377+02:00",
    "stale": false
  },
  "quota": { "limit": null, "used": 0, "remaining": null, "unlimited": true }
}
```

A distinct id nobody has identified with yet is a free user, not a 404:

```sh
curl -s "localhost:8080/v1/me?distinctId=nobody-here"
```

```json
{
  "distinctId": "nobody-here",
  "known": false,
  "person": null,
  "attributes": { "plan": "free", "notes_created": 0 },
  "entitlements": { "pro": false, "grants": [], "resolvedAt": "…", "stale": false },
  "quota": { "limit": 3, "used": 0, "remaining": 3, "unlimited": false }
}
```

### Write a note

```sh
curl -s -X POST localhost:8080/v1/notes \
  -H 'content-type: application/json' \
  -d '{"distinctId":"user-123","title":"Roadmap","body":"Ship Nimbus 1.0"}'
```

```json
{
  "note": {
    "id": "note_8bbd6ea09b34258d",
    "title": "Roadmap",
    "body": "Ship Nimbus 1.0",
    "createdAt": "2026-08-22T14:20:37.829258Z"
  },
  "quota": { "limit": 3, "used": 1, "remaining": 2, "unlimited": false }
}
```

The fourth one, for a free account:

```json
HTTP/1.1 403 Forbidden

{
  "error": "note_limit_reached",
  "message": "free accounts keep 3 notes; Nimbus Pro is unlimited",
  "paywall": { "location": "onboarding" }
}
```

### List notes

```sh
curl -s "localhost:8080/v1/notes?distinctId=user-123"
```

```json
{
  "notes": [
    {
      "id": "note_8bbd6ea09b34258d",
      "title": "Roadmap",
      "body": "Ship Nimbus 1.0",
      "createdAt": "2026-08-22T14:20:37.829258Z"
    }
  ],
  "quota": { "limit": 3, "used": 1, "remaining": 2, "unlimited": false }
}
```

### Export — Pro only

```sh
curl -s "localhost:8080/v1/notes/export?distinctId=user-123"
```

```json
HTTP/1.1 402 Payment Required

{
  "error": "premium_required",
  "message": "exporting notes requires Nimbus Pro",
  "paywall": { "location": "onboarding" }
}
```

With an active `pro` grant:

```json
{
  "distinctId": "user-pro",
  "exportedAt": "2026-08-22T14:11:11.014274Z",
  "count": 1,
  "notes": [
    {
      "id": "note_8e23d8faa7fcf6d9",
      "title": "Pro note 1",
      "body": "",
      "createdAt": "2026-08-22T14:11:10.623733Z"
    }
  ]
}
```

Either way the route captures `export_requested` with `granted: true|false`, so
the funnel from "wanted to export" to "bought Pro" is measurable.

### Forward an event

The apps capture `paywall_viewed` and `checkout_started` themselves; this route
exists for clients that would rather not hold a key.

```sh
curl -s -X POST localhost:8080/v1/events \
  -H 'content-type: application/json' \
  -d '{"distinctId":"user-123","event":"paywall_viewed","properties":{"location":"onboarding"}}'
```

```json
HTTP/1.1 202 Accepted

{
  "status": "accepted",
  "event": "paywall_viewed",
  "distinctId": "user-123",
  "accepted": 1,
  "rejected": 0
}
```

## Testing the webhook locally

Voidhash signs `${timestamp}.${rawBody}` with HMAC-SHA256 keyed by the raw
endpoint secret, and sends it as `X-Webhook-Signature: v1=<hex>`. That is three
lines of shell:

```sh
SECRET=whsec_test
BODY='{"type":"purchase.completed","distinctId":"user-123","personId":"person_01HZAB2K","productSlug":"pro-lifetime","purchaseId":"pur_01HZ","occurredAt":"2026-08-22T14:00:00.000Z"}'
TS=$(date +%s)
SIG="v1=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.*= //')"

curl -s -X POST localhost:8080/webhooks/voidhash \
  -H 'content-type: application/json' \
  -H "X-Webhook-Event: purchase.completed" \
  -H "X-Webhook-Timestamp: $TS" \
  -H "X-Webhook-Signature: $SIG" \
  -d "$BODY"
```

```json
{ "received": true, "event": "purchase.completed" }
```

Send the same body again — a fresh timestamp and signature, same payload, which
is exactly what a Voidhash retry looks like:

```json
{ "received": true, "event": "purchase.completed", "duplicate": true }
```

Tamper with the signature and you get a `400`, not a retry loop:

```json
{ "error": "invalid_webhook", "message": "invalid_signature" }
```

The real endpoint is easier still: **Studio → Project settings → Webhooks →
Send test** delivers a signed `test.ping` to whatever URL you registered. Point
it at an ngrok tunnel to your local port.

## Payments from your own billing

Besides the app stores, Nimbus sells Pro through a billing provider Voidhash
does not integrate natively. [`billing.go`](./billing.go) holds a stand-in for
it, with checkouts, subscriptions and transactions in memory, so the example
runs without a third-party account. Create a payment source with the slug
`nimbus-billing` in Studio, map the products `pro-monthly`, `pro-annual` and
`pro-lifetime`, and set its signing secret as `VOIDHASH_PROVIDER_SECRET`. Its
id (`pp_conf_…`, the last part of the address of its page in Studio) goes in
`VOIDHASH_PAYMENT_SOURCE_ID`: payments are reported to the source by id, while
its provider endpoint answers for the slug.

**Push.** [`billing_webhooks.go`](./billing_webhooks.go) handles the
provider's webhooks. A paid period reports its charge with
`PaymentSource.Charge`, naming the subscription and period it pays for, then
the subscription's state with `PaymentSource.Subscription`. Both are recorded
under the provider's own ids, so a redelivered webhook pushes them again
safely; a failed push answers `502` so the provider redelivers.

**Provider endpoint.** `fakeBilling` implements every operation, and
`provider.NewHandler` mounts it at `POST /voidhash/provider`. The handler
verifies Voidhash's signature, answers `describe` and checks each result
before replying:

| Operation             | Method               | Used for                                      |
| --------------------- | -------------------- | --------------------------------------------- |
| `catalog.list`        | `ListCatalog`        | Importing products                            |
| `history.list`        | `ListHistory`        | Importing past subscriptions and transactions |
| `subscription.get`    | `GetSubscription`    | Refreshing a subscription whose period ended  |
| `subscription.cancel` | `CancelSubscription` | Cancelling from Studio or the API             |
| `transaction.refund`  | `RefundTransaction`  | Refunding from Studio or the API              |

**Checkout.** Nimbus starts purchases itself: `POST /v1/checkout` creates the
checkout at the provider and stores the buyer's Voidhash distinct id on it, as
a real provider keeps it in the checkout's metadata, so the charge and
subscription reported later name the same person.

To try the flow, open a checkout, then deliver the provider's completion
webhook:

```sh
curl -s -X POST localhost:8080/v1/checkout \
  -H 'content-type: application/json' \
  -d '{"distinctId":"user-123","productKey":"pro-monthly"}'
# {"url":"https://billing.example/checkout/chk_1","expiresAt":"…"}

curl -s -X POST localhost:8080/webhooks/billing \
  -H 'content-type: application/json' \
  -H "x-billing-secret: $BILLING_WEBHOOK_SECRET" \
  -d '{"id":"evt_1","type":"checkout.completed","checkoutId":"chk_1"}'
```

```json
{ "received": true, "event": "checkout.completed" }
```

Renew it with `{"id":"evt_2","type":"subscription.renewed","subscriptionId":"sub_2"}`.
From the backend, `PaymentSource.CancelSubscription` and
`PaymentSource.RefundTransaction` ask Voidhash to cancel or refund through this
endpoint. [`billing_test.go`](./billing_test.go) runs the whole round trip
against a stub API:

```sh
go test ./...
```

## The three things that are easy to get wrong

### 1. The cache — [`entitlements.go`](./entitlements.go)

`entitlementCache.Access` is read-through with a 60-second TTL. It caches the
person record next to the grants, because grants are resolved _through_ the
person: a route showing both should show one consistent snapshot rather than a
fresh person beside stale grants.

Expiry is re-checked locally on read. Voidhash lists only the grants a person
can use now, but it listed this one up to a minute ago; if `expiresAt` has
passed since, the cached answer is already wrong.

### 2. Unknown is not "no" — [`entitlements.go`](./entitlements.go)

```go
func isUnknownFailure(err error) bool {
	status := voidhash.StatusCode(err)
	return status == 0 || status >= 500
}
```

A transport failure carries no status code and a 5xx is the server saying it
could not answer either. Both mean _unknown_, and unknown must never collapse
into "no grants" — that is how you revoke a customer who paid you this morning.
When the state is unknown and an expired entry exists, it is served with
`"stale": true` and a warning in the log. When nothing is cached, the honest
answer is `503 entitlements_unavailable`; guessing "free" would be the same bug
one step removed.

A `404`, by contrast, is a real answer: Voidhash has never seen this distinct
id, so the person is free. Note that the classification uses
`voidhash.IsNotFound` and `voidhash.StatusCode`, never string matching on the
error text.

### 3. Idempotency — [`webhooks.go`](./webhooks.go)

Voidhash gives a delivery 30 seconds and retries anything slower, which is how
one purchase turns into two handled events. So:

1. Verify with `voidhash.ConstructWebhookEvent` against the **raw** bytes. A
   bad signature is a `400` — retrying never fixes it.
2. Claim the delivery in a dedupe set. Already claimed → `200` with
   `"duplicate": true` and no work.
3. Acknowledge, _then_ handle.
4. If handling fails, release the claim so the next retry is processed instead
   of swallowed.

Voidhash sends no delivery id header and re-signs each retry with a fresh
timestamp, so the dedupe key is `sha256(eventType + "." + rawBody)` — the
payload bytes are what stays constant across attempts.

The set rotates two generations instead of expiring keys one by one: a key
lives one to two windows, memory is bounded by the delivery rate, and neither
`Claim` nor `Release` ever scans the map.

## What to steal for your own app

| You want                                | Take                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A cached, outage-tolerant access check  | [`entitlements.go`](./entitlements.go) — `entitlementCache`, `isUnknownFailure`, `grantIsActive` |
| Correct webhook intake                  | [`webhooks.go`](./webhooks.go) — `handleWebhook`, `deliveryKey`, `dedupeSet`                     |
| A gate that clients cannot bypass       | [`handlers.go`](./handlers.go) — `handleCreateNote`, `handleExportNotes`                         |
| Voidhash errors mapped to HTTP          | [`server.go`](./server.go) — `writeUpstreamError`                                                |
| Boot-time config validation             | [`main.go`](./main.go) — `loadConfig`                                                            |
| A provider endpoint for your billing    | [`billing.go`](./billing.go) — `fakeBilling`; [`server.go`](./server.go) — `newServer`           |
| Pushing payments from provider webhooks | [`billing_webhooks.go`](./billing_webhooks.go) — `handleBillingWebhook`, `pushPayment`           |

Two habits worth copying wholesale:

- **Enforce the quota inside the lock.** `noteStore.Create` takes the limit as
  an argument and checks it in the same critical section as the insert, so two
  concurrent requests cannot both take the last free slot.
- **Never let analytics fail a request.** `server.capture` logs and moves on.
  `POST /v1/events` is the one place a capture failure surfaces, because there
  the capture _is_ the request.

## Notes

- **Analytics runs on the secret key** ([`analytics.go`](./analytics.go)).
  `client.EventCapture.Capture` posts to ingest with the same `vh_sk_…` key as
  `client.Persons.SetAttributes` — a backend never needs a publishable key. That
  file holds the example's policy — best-effort on write paths, strict on
  `POST /v1/events` — not the request shape, which the SDK owns.
- **Person attributes are written, not just computed.** `plan` and
  `notes_created` describe the person rather than any one event, so they go to
  `Persons.SetAttributes` instead of onto every capture's properties. They are
  still exposed under `attributes` on `/v1/me` so the client can render them
  without a round trip.
- **`go.mod` carries a `replace`** pointing at `../../libraries/go`, because the
  SDK is vendored in this repository. Delete it and
  `go get github.com/voidhashcom/voidhash/libraries/go` in a real project.
- **Notes are in memory.** Restart the process and they are gone. That is the
  point — swapping in a database changes `notes.go` and nothing else.

## License

MIT — see [LICENSE.md](./LICENSE.md).
