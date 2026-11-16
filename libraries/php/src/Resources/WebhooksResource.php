<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\CreateWebhookBodyJsonEncoding;
use Voidhash\Generated\Core\Model\UpdateWebhookBodyJsonEncoding;
use Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding;
use Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding;
use Voidhash\Generated\Core\Model\WebhookJsonEncoding;
use Voidhash\Generated\Core\Model\WebhookWithSecretJsonEncoding;
use Voidhash\Internal\PageCollector;
use Voidhash\Internal\ProjectScope;

final class WebhooksResource
{
    public readonly WebhookEndpointsResource $endpoints;
    public readonly WebhookDeliveriesResource $deliveries;

    public function __construct(Client $core, ProjectScope $project)
    {
        $this->endpoints = new WebhookEndpointsResource($core, $project);
        $this->deliveries = new WebhookDeliveriesResource($core, $project);
    }
}

/** The project's webhooks: the URLs Voidhash delivers events to. */
final class WebhookEndpointsResource
{
    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
    ) {
    }

    /** Creates a webhook; the response is the only time its signing `secret` is shown. */
    public function create(CreateWebhookBodyJsonEncoding $params): WebhookWithSecretJsonEncoding
    {
        return $this->core->webhooksCreate($this->project->id(), $params) ?? throw ApiException::unexpectedResponse();
    }

    /** @return list<WebhookJsonEncoding> */
    public function list(): array
    {
        $projectId = $this->project->id();

        return PageCollector::collect(fn (array $query) => $this->core->webhooksList($projectId, $query));
    }

    public function get(string $webhookId): WebhookJsonEncoding
    {
        return $this->core->webhooksGet($this->project->id(), $webhookId) ?? throw ApiException::unexpectedResponse();
    }

    public function update(string $webhookId, UpdateWebhookBodyJsonEncoding $params): WebhookJsonEncoding
    {
        return $this->core->webhooksUpdate($this->project->id(), $webhookId, $params) ?? throw ApiException::unexpectedResponse();
    }

    public function delete(string $webhookId): void
    {
        $this->core->webhooksDelete($this->project->id(), $webhookId);
    }

    /**
     * Replaces the webhook's signing secret and returns the new one, shown
     * only this once. The previous secret stops working at once.
     */
    public function rotateSecret(string $webhookId): WebhookWithSecretJsonEncoding
    {
        return $this->core->webhooksRotate($this->project->id(), $webhookId) ?? throw ApiException::unexpectedResponse();
    }

    /** Sends a signed test delivery to the webhook. */
    public function test(string $webhookId): WebhookDeliveryJsonEncoding
    {
        return $this->core->webhooksTest($this->project->id(), $webhookId) ?? throw ApiException::unexpectedResponse();
    }
}

/** The deliveries of the project's webhooks. */
final class WebhookDeliveriesResource
{
    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
    ) {
    }

    /**
     * The webhook's deliveries.
     *
     * @return list<WebhookDeliveryJsonEncoding>
     */
    public function list(string $webhookId): array
    {
        $projectId = $this->project->id();

        return PageCollector::collect(
            fn (array $query) => $this->core->webhooksListDeliveries($projectId, $webhookId, $query),
        );
    }

    /** Fetches one delivery including its attempts. */
    public function get(string $deliveryId): WebhookDeliveryWithAttemptsJsonEncoding
    {
        return $this->core->webhooksGetDelivery($this->project->id(), $deliveryId) ?? throw ApiException::unexpectedResponse();
    }

    /** Re-delivers a failed delivery. */
    public function retry(string $deliveryId): WebhookDeliveryJsonEncoding
    {
        return $this->core->webhooksRetryDelivery($this->project->id(), $deliveryId) ?? throw ApiException::unexpectedResponse();
    }
}
