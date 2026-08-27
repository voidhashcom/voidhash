# voidhash-php

Official PHP SDK for the Voidhash API. The typed request/response surface in
`src/Generated/` is code-generated from the committed OpenAPI document
(`packages/generated-clients/openapi/core.json`) with
[jane-php](https://github.com/janephp/janephp); the hand-written layer on top
provides a Resend-style resource client.

## Install

```
composer require voidhash/voidhash-php
```

## Usage

```php
<?php

use Voidhash\VoidhashClient;

$client = VoidhashClient::create('vh_sk_...');

$person = $client->persons->getByDistinctId('user-123');
$active = $client->persons->entitlements->hasActivePerk([
    'distinctId' => 'user-123',
    'perkSlug' => 'pro',
]);
```

Resources: `$client->auth`, `apiKeys`, `persons`, `perks`, `organizations`,
`projects`, `products`, `paywalls`, `schema`, `notifications`, `users`,
`webhooks` and `eventCapture`.

### Analytics

`$client->eventCapture` posts to the ingestion API with the same secret key,
sent as `x-secret-key`; no publishable key is required:

```php
$client->eventCapture->capture([
    'event' => 'paywall_viewed',
    'distinctId' => 'user-123',
    'timestamp' => new \DateTimeImmutable('now'),
    'properties' => ['paywall_id' => 'pw_1'],
]);

$client->eventCapture->batch([
    [
        'event' => 'paywall_viewed',
        'distinctId' => 'user-123',
        'timestamp' => new \DateTimeImmutable('now'),
    ],
    [
        'event' => 'purchase_completed',
        'distinctId' => 'user-123',
        'timestamp' => new \DateTimeImmutable('now'),
    ],
]);
```

Both return `['accepted' => int, 'rejected' => int]`. Each event gets a `uuid`
deduplication key; pass your own to make a retry idempotent. `timestamp` is
required; `sessionId`, `context` and `properties` are optional.

Pass `publishableKey` to `VoidhashClient::create()` only if you want the ingest
body `token` a browser SDK would send; it is never the capture credential.

### Errors

Every non-2xx response throws `Voidhash\Exception\ApiException`. `getTag()`
carries the server-side discriminant exactly as sent on the wire (for example
`Api/PersonNotFoundError`).

### Webhooks

Verify inbound deliveries with
`Voidhash\Webhooks::constructEvent($payload, $headers, $secret)` — pass the
raw body string exactly as received.

## Regenerating the API surface

Run `pnpm openapi:generate:dev <host>` from `voidhash/` (see
`scripts/generate-openapi-clients.mjs`), or locally:

```
composer install
vendor/bin/jane-openapi generate --config-file jane-config.php
```

## Development

```
composer test
```
