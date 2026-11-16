<?php

declare(strict_types=1);

namespace Voidhash\Provider;

use Nyholm\Psr7\Response;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Voidhash\Internal\ProviderProtocol;
use Voidhash\PaymentSources\Environment;
use Voidhash\Webhooks;

/**
 * Answers the signed requests Voidhash sends to a payment source's provider
 * endpoint. The operations it supports are the interfaces the provider
 * implements: {@see CatalogSource}, {@see HistorySource},
 * {@see SubscriptionSource}, {@see SubscriptionCancellation} and
 * {@see TransactionRefunds}; `describe` is answered for you.
 *
 * Every request is verified before its body is read: `x-voidhash-signature`
 * must be `v1=` and the HMAC-SHA256 of `${timestamp}.${rawBody}` keyed by the
 * signing secret, and `x-voidhash-timestamp` within 300 seconds of this
 * server's clock. What the provider returns is checked against the protocol
 * before it is sent, and a violation is answered as `invalid_result` with the
 * field at fault.
 *
 *     $handler = new ProviderHandler('paddle', $_ENV['VOIDHASH_PROVIDER_SECRET'], new PaddleProvider());
 *     $handler->respondToGlobals();
 */
final class ProviderHandler implements RequestHandlerInterface
{
    public const SIGNATURE_HEADER = 'x-voidhash-signature';
    public const TIMESTAMP_HEADER = 'x-voidhash-timestamp';

    private const TOLERANCE_SECONDS = 300;
    private const HIDDEN_PROVIDER_ERROR_MESSAGE = 'The provider failed to handle the request';
    private const ERROR_STATUS = [
        'invalid_signature' => 401,
        'invalid_request' => 400,
        'unsupported_operation' => 404,
        'not_found' => 404,
        'unavailable' => 503,
        'invalid_result' => 500,
        'provider_error' => 500,
    ];

    /**
     * Each supported operation, taking its parsed input and answering with
     * its result in wire form.
     *
     * @var array<string, \Closure(array<string, mixed>, Environment): mixed>
     */
    private readonly array $operations;

    /**
     * @param string $source the slug of the payment source this endpoint serves
     * @param string $signingSecret the source's endpoint signing secret (vhps_...) from Studio
     */
    public function __construct(
        public readonly string $source,
        private readonly string $signingSecret,
        CatalogSource|HistorySource|SubscriptionSource|SubscriptionCancellation|TransactionRefunds $provider,
    ) {
        $operations = [];
        if ($provider instanceof CatalogSource) {
            $operations['catalog.list'] = static fn (array $input, Environment $environment): array => self::catalogPageToWire(
                $provider->listCatalog(new CatalogRequest($input['cursor'], $environment)),
            );
        }
        if ($provider instanceof HistorySource) {
            $operations['history.list'] = static fn (array $input, Environment $environment): array => self::historyPageToWire(
                $provider->listHistory(new HistoryRequest($input['kind'], $input['cursor'], $input['before'], $environment)),
            );
        }
        if ($provider instanceof SubscriptionSource) {
            $operations['subscription.get'] = static function (array $input, Environment $environment) use ($provider): array {
                $subscription = $provider->getSubscription(new SubscriptionRequest($input['id'], $environment));

                return ['subscription' => $subscription === null ? null : self::subscriptionToWire($subscription)];
            };
        }
        if ($provider instanceof SubscriptionCancellation) {
            $operations['subscription.cancel'] = static fn (array $input, Environment $environment): array => [
                'subscription' => self::subscriptionToWire(
                    $provider->cancelSubscription(new CancelSubscriptionRequest($input['id'], $input['atPeriodEnd'], $environment)),
                ),
            ];
        }
        if ($provider instanceof TransactionRefunds) {
            $operations['transaction.refund'] = static fn (array $input, Environment $environment): array => [
                'refund' => self::transactionToWire($provider->refundTransaction(
                    new RefundTransactionRequest($input['transactionId'], $input['amount'], $input['reason'], $environment),
                )),
            ];
        }
        $this->operations = $operations;
    }

    /**
     * A handler whose operations answer in wire form directly, for replaying
     * the protocol's conformance cases.
     *
     * @internal
     *
     * @param array<string, \Closure(array<string, mixed>, Environment): mixed> $operations
     */
    public static function fromWireOperations(string $source, string $signingSecret, array $operations): self
    {
        $handler = (new \ReflectionClass(self::class))->newInstanceWithoutConstructor();
        $handler->source = $source;
        $handler->signingSecret = $signingSecret;
        $handler->operations = $operations;

        return $handler;
    }

    /** Answers a PSR-7 request; mount it on the HTTPS route registered as the source's endpoint. */
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        return $this->handlePayload((string) $request->getBody(), $request->getHeaders());
    }

    /**
     * Answers the current request in plain PHP: reads `php://input` and the
     * request headers, then emits the status, content type and body.
     */
    public function respondToGlobals(): void
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (is_string($key) && str_starts_with($key, 'HTTP_') && is_string($value)) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = $value;
            }
        }
        $response = $this->handlePayload((string) file_get_contents('php://input'), $headers);

        http_response_code($response->getStatusCode());
        header('content-type: ' . $response->getHeaderLine('content-type'));
        echo $response->getBody();
    }

    /**
     * Answers one request from its raw body and headers, for frameworks that
     * are not PSR-7.
     *
     * @param string $payload raw request body, exactly as received
     * @param array<string, string|list<string>> $headers inbound headers, looked up case-insensitively
     * @param \DateTimeImmutable|null $now injectable for tests
     */
    public function handlePayload(string $payload, array $headers, ?\DateTimeImmutable $now = null): ResponseInterface
    {
        $timestamp = self::readHeader($headers, self::TIMESTAMP_HEADER);
        $signature = self::readHeader($headers, self::SIGNATURE_HEADER);
        if (
            $timestamp === null
            || $signature === null
            || !Webhooks::verifySignature($payload, $signature, $timestamp, $this->signingSecret, self::TOLERANCE_SECONDS, $now)
        ) {
            return self::error(null, 'invalid_signature', 'The signature or timestamp check failed');
        }

        try {
            $request = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return self::error(null, 'invalid_request', 'The body is not JSON');
        }
        if (!is_array($request) || ($request !== [] && array_is_list($request))) {
            return self::error(null, 'invalid_request', 'The body is not a JSON object');
        }

        $id = is_string($request['id'] ?? null) ? $request['id'] : null;
        if ($id === null) {
            return self::error(null, 'invalid_request', 'id must be a string');
        }
        if (($request['protocolVersion'] ?? null) !== ProviderProtocol::VERSION) {
            return self::error($id, 'invalid_request', sprintf('protocolVersion must be %d', ProviderProtocol::VERSION));
        }
        if (($request['source'] ?? null) !== $this->source) {
            return self::error($id, 'invalid_request', sprintf('This endpoint serves the source "%s"', $this->source));
        }
        $environment = is_string($request['environment'] ?? null) ? Environment::tryFrom($request['environment']) : null;
        if ($environment === null) {
            return self::error($id, 'invalid_request', 'environment must be production or test');
        }
        $operation = $request['operation'] ?? null;
        if (!is_string($operation)) {
            return self::error($id, 'invalid_request', 'operation must be a string');
        }
        if ($operation === 'describe') {
            return self::reply($id, $this->describe());
        }
        $call = $this->operations[$operation] ?? null;
        if ($call === null) {
            return self::error($id, 'unsupported_operation', sprintf('This endpoint does not implement "%s"', $operation));
        }

        try {
            $input = ProviderProtocol::parseInput($operation, $request['input'] ?? null);
            $result = $call($input, $environment);
        } catch (ProviderException $exception) {
            return self::error($id, $exception->errorCode->value, $exception->getMessage());
        } catch (\Throwable $exception) {
            return self::error(
                $id,
                'provider_error',
                $environment === Environment::Test ? $exception->getMessage() : self::HIDDEN_PROVIDER_ERROR_MESSAGE,
            );
        }

        $problem = ProviderProtocol::resultProblem($operation, $input, $result);
        if ($problem !== null) {
            return self::error($id, 'invalid_result', $problem);
        }

        return self::reply($id, $result);
    }

    /**
     * The `v1=` signature Voidhash would send for a payload.
     *
     * @internal used by {@see ProviderTester}
     */
    public function sign(string $timestamp, string $payload): string
    {
        return 'v1=' . hash_hmac('sha256', $timestamp . '.' . $payload, $this->signingSecret);
    }

    /** @return array<string, mixed> */
    private function describe(): array
    {
        $operations = [...array_keys($this->operations), 'describe'];
        sort($operations, SORT_STRING);

        $version = class_exists(\Composer\InstalledVersions::class) && \Composer\InstalledVersions::isInstalled('voidhash/voidhash-php')
            ? \Composer\InstalledVersions::getPrettyVersion('voidhash/voidhash-php')
            : null;

        return [
            'protocolVersion' => ProviderProtocol::VERSION,
            'source' => $this->source,
            'operations' => $operations,
            'sdk' => ['name' => 'voidhash-php', 'version' => $version ?? 'unknown'],
        ];
    }

    private static function reply(string $id, mixed $result): ResponseInterface
    {
        try {
            $body = json_encode(['id' => $id, 'result' => $result], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        } catch (\JsonException $exception) {
            return self::error($id, 'invalid_result', 'The result cannot be encoded as JSON: ' . $exception->getMessage());
        }

        return new Response(200, ['content-type' => 'application/json'], $body);
    }

    private static function error(?string $id, string $code, string $message): ResponseInterface
    {
        $body = json_encode(
            ['id' => $id, 'error' => ['code' => $code, 'message' => $message]],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE,
        );

        return new Response(self::ERROR_STATUS[$code], ['content-type' => 'application/json'], (string) $body);
    }

    /**
     * The one value a header carries; a repeated or empty header counts as
     * missing, since an ambiguous signing header cannot be trusted.
     *
     * @param array<string, string|list<string>> $headers
     */
    private static function readHeader(array $headers, string $name): ?string
    {
        foreach ($headers as $headerName => $value) {
            if (strtolower((string) $headerName) !== $name) {
                continue;
            }
            if (is_array($value)) {
                if (count($value) !== 1) {
                    return null;
                }
                $value = $value[0];
            }

            return is_string($value) && $value !== '' ? $value : null;
        }

        return null;
    }

    /** @return array<string, mixed> */
    private static function catalogPageToWire(CatalogPage $page): array
    {
        return [
            'items' => array_map(
                static fn (CatalogProduct $product): array => [
                    'key' => $product->key,
                    'name' => $product->name,
                    'kind' => $product->kind->value,
                ],
                $page->items,
            ),
            'nextCursor' => $page->nextCursor,
        ];
    }

    /** @return array<string, mixed> */
    private static function historyPageToWire(HistoryPage $page): array
    {
        return [
            'items' => array_map(
                static fn (Subscription|Transaction $item): array => $item instanceof Subscription
                    ? self::subscriptionToWire($item)
                    : self::transactionToWire($item),
                $page->items,
            ),
            'nextCursor' => $page->nextCursor,
        ];
    }

    /** @return array<string, mixed> */
    private static function subscriptionToWire(Subscription $subscription): array
    {
        return array_filter([
            'id' => $subscription->id,
            'distinctId' => $subscription->distinctId,
            'customer' => $subscription->customerId === null ? null : ['externalId' => $subscription->customerId],
            'productKey' => $subscription->productKey,
            'status' => $subscription->status->value,
            'currentPeriodStart' => ProviderProtocol::formatDate($subscription->currentPeriodStart),
            'currentPeriodEnd' => ProviderProtocol::formatDate($subscription->currentPeriodEnd),
            'willRenew' => $subscription->willRenew,
            'canceledAt' => $subscription->canceledAt === null ? null : ProviderProtocol::formatDate($subscription->canceledAt),
            'updatedAt' => ProviderProtocol::formatDate($subscription->updatedAt),
        ], static fn (mixed $value): bool => $value !== null);
    }

    /** @return array<string, mixed> */
    private static function transactionToWire(Transaction $transaction): array
    {
        return array_filter([
            'id' => $transaction->id,
            'type' => $transaction->type->value,
            'distinctId' => $transaction->distinctId,
            'customer' => $transaction->customerId === null ? null : ['externalId' => $transaction->customerId],
            'productKey' => $transaction->productKey,
            'amount' => $transaction->amount,
            'currency' => $transaction->currency,
            'fee' => $transaction->fee,
            'tax' => $transaction->tax,
            'occurredAt' => ProviderProtocol::formatDate($transaction->occurredAt),
            'subscriptionId' => $transaction->subscriptionId,
            'periodStart' => $transaction->periodStart === null ? null : ProviderProtocol::formatDate($transaction->periodStart),
            'periodEnd' => $transaction->periodEnd === null ? null : ProviderProtocol::formatDate($transaction->periodEnd),
            'refundsTransactionId' => $transaction->refundsTransactionId,
        ], static fn (mixed $value): bool => $value !== null);
    }
}
