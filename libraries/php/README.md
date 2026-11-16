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

A secret key is created as production (`vh_sk_…`) or test (`vh_sk_test_…`) and
keeps that [environment](https://voidhash.com/docs/concepts/api-keys)
for life. Use a test key in staging and tests, and a production key in
production.

Resources: `$client->auth`, `apiKeys`, `persons`, `perks`, `organizations`,
`projects`, `products`, `paywalls`, `paymentSources`, `schema`,
`notifications`, `users`, `webhooks` and `eventCapture`. Lists return every
item, following the pages for you.

The secret key is sent as `Authorization: Bearer`. Calls about a project's
data are made in the key's project, which the client asks the API for once,
on its first such call. Pass `projectId` to skip that lookup, or to choose a
project when the credential can use several, such as a CLI key:

```php
$client = VoidhashClient::create('vh_sk_...', ['projectId' => 'prj_...']);
```

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

`groups` names an event's groups, such as the user's company, sent as its `$groups` property.
`groupIdentify` sets a group's properties with a `$groupidentify` event that belongs to no person;
a later change of a property wins, and `setOnce` fills only missing ones:

```php
$client->eventCapture->groupIdentify([
    'groupType' => 'company',
    'groupKey' => 'acme',
    'properties' => ['name' => 'Acme', 'plan' => 'pro', 'seats' => 40],
]);
```

### Payment sources

Report payments from a provider Voidhash does not integrate natively under
the provider's own ids. Recording is idempotent, so a retry is safe. Amounts
are integers in minor units. `source()` takes the source's payment provider
id, which Studio shows in the source's transactions endpoint, and makes no
request of its own. When your server creates a checkout at the provider, store
the buyer's distinct id on it (in its metadata, for example), so the payment
you report names them.

```php
use Voidhash\PaymentSources\{Charge, Refund, SubscriptionState, SubscriptionStatus};

$paddle = $client->paymentSources->source('pp_conf_...'); // the source's payment provider id in Studio

$paddle->charge('txn_123', new Charge(
    productKey: 'pri_monthly',
    amount: 4900,
    currency: 'EUR',
    occurredAt: new \DateTimeImmutable(),
    distinctId: 'user-123',
    subscriptionId: 'sub_9',
    periodStart: new \DateTimeImmutable('2026-10-01T00:00:00Z'),
    periodEnd: new \DateTimeImmutable('2026-11-01T00:00:00Z'),
));
$paddle->refund('re_1', new Refund(
    refundsTransactionId: 'txn_123',
    amount: 4900,
    currency: 'EUR',
    occurredAt: new \DateTimeImmutable(),
));
$paddle->subscription('sub_9', new SubscriptionState(
    productKey: 'pri_monthly',
    status: SubscriptionStatus::Active,
    currentPeriodStart: new \DateTimeImmutable('2026-10-01T00:00:00Z'),
    currentPeriodEnd: new \DateTimeImmutable('2026-11-01T00:00:00Z'),
    isAutoRenewing: true,
    updatedAt: new \DateTimeImmutable(),
    distinctId: 'user-123',
));
```

`cancelSubscription` and `refundTransaction` ask the source to act instead of
reporting what it did: Voidhash calls the source's provider endpoint (below)
and records what it answers. `refundTransaction` refunds everything left of
the charge unless you pass an `amount`; it is not the same as `refund`, which
reports a refund the source already made. When the endpoint cannot act, they
throw an `ApiException` of type `conflict` or `unavailable` whose code says
why (`payment_source_endpoint_rejected`, `payment_source_endpoint_unavailable`,
...).

```php
$paddle->cancelSubscription('sub_9');                    // at the end of the period
$paddle->cancelSubscription('sub_9', isImmediate: true); // now
$paddle->refundTransaction('txn_123', amount: 1000, reason: 'requested_by_customer');
```

To let Voidhash import the provider's catalog and history, refresh a
subscription, cancel and refund, register a provider endpoint for the source
in Studio and serve it with `Voidhash\Provider\ProviderHandler`. The interfaces
your class implements decide the operations it supports:

| Interface                  | Method                                                        | Operation             |
| -------------------------- | ------------------------------------------------------------- | --------------------- |
| `CatalogSource`            | `listCatalog(CatalogRequest): CatalogPage`                    | `catalog.list`        |
| `HistorySource`            | `listHistory(HistoryRequest): HistoryPage`                    | `history.list`        |
| `SubscriptionSource`       | `getSubscription(SubscriptionRequest): ?Subscription`         | `subscription.get`    |
| `SubscriptionCancellation` | `cancelSubscription(CancelSubscriptionRequest): Subscription` | `subscription.cancel` |
| `TransactionRefunds`       | `refundTransaction(RefundTransactionRequest): Transaction`    | `transaction.refund`  |

A cancellation returns the subscription's state afterwards, and a refund the
refund transaction (`TransactionType::Refund`, naming the charge in
`refundsTransactionId`); Voidhash records both as if you had reported them.

```php
use Voidhash\Provider\{CatalogPage, CatalogProduct, CatalogRequest, CatalogSource};
use Voidhash\Provider\{ProductKind, ProviderErrorCode, ProviderException, ProviderHandler};

final class PaddleProvider implements CatalogSource
{
    public function listCatalog(CatalogRequest $request): CatalogPage
    {
        // throw new ProviderException(ProviderErrorCode::Unavailable, 'Paddle is down');
        return new CatalogPage(
            [new CatalogProduct(key: 'pri_monthly', name: 'Pro monthly', kind: ProductKind::Subscription)],
            nextCursor: null,
        );
    }
}

$handler = new ProviderHandler('paddle', $_ENV['VOIDHASH_PROVIDER_SECRET'], new PaddleProvider());
$handler->respondToGlobals(); // or $handler->handle($psr7Request) as a PSR-15 handler
```

The handler verifies each request's signature and timestamp, answers
`describe` itself, and checks what your class returns before sending it; a
result the protocol does not allow is answered `invalid_result` with the field
at fault. Throw `ProviderException` to answer `invalid_request`, `not_found` or
`unavailable` with your message. Any other exception is answered
`provider_error`, and its message is shown only for test requests.

In tests, `ProviderTester::call($handler, 'catalog.list', ['cursor' => null])`
sends a correctly signed request through the handler and returns its response.

[`examples/backend-php`](../../examples/backend-php) serves every operation
against a stand-in provider and reports its payments with the calls above.

### Errors

Every non-2xx response throws `Voidhash\Exception\ApiException`. Branch on
`getType()` (`invalid_request`, `unauthenticated`, `permission_denied`,
`not_found`, `conflict`, `rate_limited`, `unavailable`, `internal`) and the
more specific `getErrorCode()` (for example `person_not_found`), not on the
message. `getParam()` names the field at fault, `getStatus()` is the HTTP
status, and `getRequestId()` identifies the request if you contact support.

```php
use Voidhash\Exception\ApiException;

try {
    $client->persons->get('per_123');
} catch (ApiException $e) {
    if ($e->getErrorCode() === 'person_not_found') {
        // ...
    }
}
```

A client that cannot make a call as configured, for example one whose
credential can use several projects but has no `projectId`, throws an
`ApiException` with status 0 and code `configuration_error`.

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
