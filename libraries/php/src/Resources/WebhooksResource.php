<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\CreateWebhookEndpointBodyJsonEncoding;
use Voidhash\Generated\Core\Model\UpdateWebhookEndpointBodyJsonEncoding;
use Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding;
use Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding;
use Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding;

final class WebhooksResource
{
    public readonly WebhookEndpointsResource $endpoints;
    public readonly WebhookDeliveriesResource $deliveries;

    public function __construct(private readonly Client $core)
    {
        $this->endpoints = new WebhookEndpointsResource($core);
        $this->deliveries = new WebhookDeliveriesResource($core);
    }
}

final class WebhookEndpointsResource
{
    public function __construct(private readonly Client $core)
    {
    }

    public function create(CreateWebhookEndpointBodyJsonEncoding $params): ?WebhookEndpointJsonEncoding
    {
        return $this->wrap(fn () => $this->core->webhooksCreateWebhookEndpoint($params));
    }

    /** @return list<WebhookEndpointJsonEncoding> */
    public function list(): array
    {
        return $this->wrap(fn () => $this->core->webhooksListWebhookEndpoints() ?? []);
    }

    public function get(string $endpointId): ?WebhookEndpointJsonEncoding
    {
        return $this->wrap(fn () => $this->core->webhooksGetWebhookEndpoint($endpointId));
    }

    public function update(string $endpointId, UpdateWebhookEndpointBodyJsonEncoding $params): ?WebhookEndpointJsonEncoding
    {
        return $this->wrap(fn () => $this->core->webhooksUpdateWebhookEndpoint($endpointId, $params));
    }

    public function delete(string $endpointId): void
    {
        $this->wrap(function () use ($endpointId): null {
            $this->core->webhooksDeleteWebhookEndpoint($endpointId);

            return null;
        });
    }

    public function rotateSecret(string $endpointId): ?WebhookEndpointJsonEncoding
    {
        return $this->wrap(fn () => $this->core->webhooksRotateWebhookSecret($endpointId));
    }

    /** Sends a signed test delivery to the endpoint. */
    public function test(string $endpointId): ?WebhookDeliveryJsonEncoding
    {
        return $this->wrap(fn () => $this->core->webhooksTestWebhookEndpoint($endpointId));
    }

    /** @template T @param callable(): T $call @return T */
    private function wrap(callable $call): mixed
    {
        try {
            return $call();
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}

final class WebhookDeliveriesResource
{
    public function __construct(private readonly Client $core)
    {
    }

    /** @return list<WebhookDeliveryJsonEncoding> */
    public function list(): array
    {
        return $this->wrap(fn () => $this->core->webhooksListWebhookDeliveries() ?? []);
    }

    /** Fetches one delivery including its attempts. */
    public function get(string $deliveryId): ?WebhookDeliveryWithAttemptsJsonEncoding
    {
        return $this->wrap(fn () => $this->core->webhooksGetWebhookDelivery($deliveryId));
    }

    /** Re-delivers a failed delivery. */
    public function retry(string $deliveryId): ?WebhookDeliveryJsonEncoding
    {
        return $this->wrap(fn () => $this->core->webhooksRetryWebhookDelivery($deliveryId));
    }

    /** @template T @param callable(): T $call @return T */
    private function wrap(callable $call): mixed
    {
        try {
            return $call();
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
