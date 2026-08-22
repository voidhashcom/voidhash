# backend-php

Nimbus — a notes app with a Pro tier — implemented as a PHP HTTP service on top
of [`voidhash/voidhash-php`](../../libraries/php). Free accounts keep 3 notes;
Pro is unlimited and can export. Every backend example in
[`examples/`](../README.md) implements the same routes, so this one is the PHP
answer to a question you can also read in Node, Go or Rust.

There is no framework here. A front controller (`public/index.php`), a router
that matches exact paths, and a handful of small classes — because the
interesting parts are entitlement checking and webhook verification, not
dependency injection. It also makes the one rule that trips up every PHP
webhook integration unavoidable: the body is read once from `php://input`, and
`$_POST` is never touched.

## What it demonstrates

- **Entitlement checks on the hot path**, behind a 60 second cache.
- **Degrading instead of denying.** When Voidhash is unreachable the last known
  answer is served stale; a paying customer does not lose Pro because of a
  network blip.
- **Idempotent webhook handling**, because a delivery that was slow to
  acknowledge arrives twice.
- **Error mapping that means something.** An unknown distinct id is a free
  user, a rejected secret key is a 500 on our side, a 5xx upstream is a 503.
- **Server-side analytics**, so the browser never sees a key.

## Prerequisites

- PHP 8.2, 8.3 or 8.4 with `ext-json` (`php -v`)
- [Composer](https://getcomposer.org) 2
- A Voidhash project with a `pro` perk. Create one in
  [Studio](https://voidhash.com), then take a secret key from
  **Project settings → API keys**.

## Setup

```
composer install
cp .env.example .env
$EDITOR .env
```

| Variable | Required | Default |
| --- | --- | --- |
| `VOIDHASH_SECRET_KEY` | yes | — |
| `VOIDHASH_WEBHOOK_SECRET` | for `POST /webhooks/voidhash` | — |
| `VOIDHASH_BASE_URL` | no | `https://api.voidhash.com` |
| `VOIDHASH_INGEST_URL` | no | `https://ingest.voidhash.com` |
| `PORT` | no | `8080` |
| `NIMBUS_STATE_DIR` | no | `<tmp>/nimbus-backend-php` |

The service refuses to start without `VOIDHASH_SECRET_KEY` and says so on
stderr rather than failing on the first request that needs it. Everything else
is optional; the secret key is the only credential the SDK needs, analytics
included.

`.env` is read by `Config::loadDotEnv()` for convenience. Exported environment
variables win, which is what you want in production — never ship the file.

## Run

```
php -S localhost:8080 -t public
```

`composer serve` does the same thing. The built-in server is single threaded
and single process; see [Deploying](#deploying) before you point real traffic
at it.

## The API

Every response is JSON. Errors carry a machine-readable `error` and a
human-readable `message`.

### `GET /health`

Liveness. Never calls Voidhash — a health check that depends on a third party
takes your service down with them.

```
$ curl localhost:8080/health
{
    "status": "ok",
    "service": "nimbus-backend-php"
}
```

### `GET /v1/me?distinctId=…`

The person and their entitlement grants.

```
$ curl 'localhost:8080/v1/me?distinctId=pro-user'
{
    "distinctId": "pro-user",
    "person": {
        "personId": "person_pro-user",
        "distinctId": "pro-user",
        "email": "pro-user@example.com",
        "name": null
    },
    "plan": "pro",
    "notesCreated": 0,
    "perks": [
        "pro"
    ],
    "grants": [
        {
            "perkId": "perk_pro",
            "perkSlug": "pro",
            "status": "active",
            "source": "subscription",
            "expiresAt": "2027-01-01T00:00:00Z"
        }
    ],
    "freshness": "live"
}
```

A distinct id Voidhash has never seen is **not** an error — it is what a free
user looks like before they sign in:

```
$ curl 'localhost:8080/v1/me?distinctId=nobody'
{
    "distinctId": "nobody",
    "person": null,
    "plan": "free",
    "notesCreated": 0,
    "perks": [],
    "grants": [],
    "freshness": "live"
}
```

`freshness` is `live`, `cached`, `stale` or `unknown`. See
[Degrading](#degrading-instead-of-denying).

### `GET /v1/notes?distinctId=…`

The caller's notes and their remaining free quota. `limit` and `remaining` are
`null` for Pro, where the question does not apply.

```
$ curl 'localhost:8080/v1/notes?distinctId=free-user'
{
    "distinctId": "free-user",
    "plan": "free",
    "notes": [
        {
            "id": "note_65acedabc59a1804",
            "title": "Note 1",
            "body": "body 1",
            "createdAt": "2026-08-22T14:20:22Z"
        }
    ],
    "limit": 3,
    "remaining": 2,
    "freshness": "cached"
}
```

### `POST /v1/notes`

Creates a note and captures `note_created`. The quota is enforced here, not in
the client: the app hides the button, but the button is not the security
boundary.

```
$ curl -X POST localhost:8080/v1/notes \
    -H 'Content-Type: application/json' \
    -d '{"distinctId":"free-user","title":"Note 4","body":"…"}'
{
    "note": {
        "id": "note_a88602d669829989",
        "title": "Note 4",
        "body": "…",
        "createdAt": "2026-08-22T14:20:22Z"
    },
    "plan": "free",
    "remaining": 0
}
```

Once a free account holds 3, the same call is a `403` and tells the client
which paywall to present:

```
{
    "error": "note_limit_reached",
    "message": "free accounts keep 3 notes; upgrade to Pro for unlimited notes",
    "paywall": {
        "location": "onboarding",
        "perk": "pro"
    }
}
```

### `GET /v1/notes/export?distinctId=…`

Pro only. Captures `export_requested`.

```
$ curl 'localhost:8080/v1/notes/export?distinctId=pro-user'
{
    "format": "markdown",
    "noteCount": 2,
    "content": "# Note 1\n\nbody 1\n\n# Note 2\n\nbody 2"
}
```

Without the `pro` perk it is a `402`:

```
{
    "error": "premium_required",
    "message": "exporting notes requires the Pro perk",
    "paywall": {
        "location": "onboarding",
        "perk": "pro"
    }
}
```

### `POST /v1/events`

Forwards a client-supplied analytics event. This is how a browser gets an event
into Voidhash without holding a key.

```
$ curl -X POST localhost:8080/v1/events \
    -H 'Content-Type: application/json' \
    -d '{"distinctId":"free-user","event":"checkout_started","properties":{"product":"pro-monthly"}}'
{
    "status": "accepted",
    "event": "checkout_started",
    "distinctId": "free-user"
}
```

### `POST /webhooks/voidhash`

Verifies the signature, acknowledges, then handles the event. Covered in the
next section.

## Testing the webhook locally

Create a webhook endpoint in Studio to get a `whsec_…` secret, put it in
`VOIDHASH_WEBHOOK_SECRET`, and sign a delivery yourself:

```
$ php scripts/send-webhook.php subscription.created user-123
HTTP/1.1 200 OK
…
{
    "received": true,
    "type": "subscription.created"
}
```

The script builds a `subscription.created` payload, signs
`{timestamp}.{body}` with HMAC-SHA256, and posts it with the three headers
Voidhash sends. `php scripts/send-webhook.php subscription.expired user-123`
works the same way for any event name.

To watch the dedupe set do its job, post one signed body **twice** — which is
exactly what a Voidhash retry looks like:

```
BODY='{"type":"subscription.renewed","distinctId":"user-123"}'
TS=$(date +%s)
SIG="v1=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$VOIDHASH_WEBHOOK_SECRET" -r | cut -d' ' -f1)"

for _ in 1 2; do
  curl -s -X POST localhost:8080/webhooks/voidhash \
    -H "X-Webhook-Event: subscription.renewed" \
    -H "X-Webhook-Timestamp: $TS" \
    -H "X-Webhook-Signature: $SIG" \
    -d "$BODY"
done
```

Both calls answer `200`; the log shows the second one being dropped:

```
{"level":"info","message":"webhook received","type":"subscription.renewed","distinctId":"user-123"}
{"level":"info","message":"webhook redelivery ignored","type":"subscription.renewed","key":"subscription.renewed:2242e3cc…"}
```

To receive real deliveries, expose the port with a tunnel (`cloudflared tunnel
--url http://localhost:8080`, `ngrok http 8080`) and point the Studio endpoint
at `https://…/webhooks/voidhash`.

### Why the raw body matters

Voidhash signs the exact bytes it sent. Read them once from `php://input` and
verify before parsing:

```php
$raw = file_get_contents('php://input');
$event = Webhooks::constructEvent($raw, $headers, $secret);
```

`$_POST` is not an option. It is only populated for form content types, it is
already parsed, and re-encoding a parsed body changes key order, unicode
escapes and whitespace — after which every signature fails. The same applies to
any framework middleware that decodes the body before your handler runs.

## The three things that are easy to get wrong

### A cache in front of the check

`GET /v1/notes` and `POST /v1/notes` both ask "is this person Pro?", and each
answer costs three round trips (person, grants, perk catalogue). The check sits
behind a 60 second cache in
[`src/Nimbus/EntitlementCache.php`](src/Nimbus/EntitlementCache.php); webhooks
invalidate the key so a purchase shows up immediately rather than a minute
later.

### Degrading instead of denying

A transport error or a 5xx means Voidhash told you *nothing*, which is not the
same as telling you "no". The cache serves its last answer past the TTL
(`freshness: stale`) so a subscriber keeps working through an outage, and a
distinct id with nothing cached comes back `unknown` and is deliberately not
written to the cache — caching an outage turns a 30 second blip into 90.

[`src/Nimbus/EntitlementResolver.php`](src/Nimbus/EntitlementResolver.php) is
where failures get sorted. Note that a transport failure arrives as a PSR-18
`ClientExceptionInterface`, not as `Voidhash\Exception\ApiException`: the SDK
only wraps responses it actually received.

### Idempotent webhook handling

Voidhash retries a delivery it did not get a prompt `2xx` for, so a slow handler
manufactures its own duplicates. The route acknowledges first (under php-fpm,
via `fastcgi_finish_request()`) and works afterwards, and
[`src/Nimbus/WebhookHandler.php`](src/Nimbus/WebhookHandler.php) keys a dedupe
set on `sha256` of the raw body — Voidhash posts the bare payload with no
delivery id, and a retry re-signs the *same bytes* with a fresh timestamp, so
the body is the stable identity.

## State, and why it is a file

The other examples in this suite keep notes, the entitlement cache and the
dedupe set in a process-global map. PHP cannot: the request *is* the process
lifetime, so a `static` array is empty again on the next call.
[`src/Nimbus/StateFile.php`](src/Nimbus/StateFile.php) writes a JSON document
under `flock()` instead, which behaves like the other examples and keeps the
demo dependency free.

Do not ship it. Use APCu for a single box or Redis for more than one — the
three classes built on `StateFile` are the only places that change.

## Deploying

`php -S` is a development server: one request at a time, no process manager, no
TLS. In production run php-fpm behind nginx with `public/` as the document root:

```nginx
server {
    listen 80;
    root /srv/nimbus/public;

    location / {
        try_files $uri /index.php$is_args$args;
    }

    location ~ ^/index\.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root/index.php;

        # Webhook payloads are small; a low limit here is a cheap DoS guard.
        client_max_body_size 1m;
    }
}
```

Three things to get right:

- Only `public/` is served. `src/`, `vendor/` and `.env` stay outside the
  document root.
- Pass the environment through (`env[VOIDHASH_SECRET_KEY]` in the pool config,
  or your orchestrator's secret store) rather than shipping `.env`.
- Do not buffer or rewrite request bodies in front of `/webhooks/voidhash`.

## What to steal

| You want | Read |
| --- | --- |
| Verify a webhook without breaking the signature | [`src/Controller/WebhookController.php`](src/Controller/WebhookController.php) |
| Handle a redelivery exactly once | [`src/Nimbus/WebhookHandler.php`](src/Nimbus/WebhookHandler.php) |
| Cache an entitlement check and survive an outage | [`src/Nimbus/EntitlementCache.php`](src/Nimbus/EntitlementCache.php) |
| Turn SDK failures into the right HTTP status | [`src/Nimbus/EntitlementResolver.php`](src/Nimbus/EntitlementResolver.php), [`src/Application.php`](src/Application.php) |
| Resolve grants to perk slugs | [`src/Nimbus/EntitlementResolver.php`](src/Nimbus/EntitlementResolver.php) |
| Capture an event from the server | [`src/Nimbus/Analytics.php`](src/Nimbus/Analytics.php) |
| Validate configuration at boot | [`src/Config.php`](src/Config.php), [`public/index.php`](public/index.php) |

## One credential, two writes

[`src/Nimbus/Analytics.php`](src/Nimbus/Analytics.php) writes to analytics two
different ways, both on the project's secret key:

- `$client->eventCapture->capture()` posts to ingest, authenticated with the
  secret key in the `x-secret-key` header. No publishable key is involved: that
  one belongs in clients, not on your server.
- `$client->persons->setAttributes()` is a server-to-server write. Traits
  describe the person and persist, so `plan` and `notes_created` go there
  rather than onto every event's properties.
