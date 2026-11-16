<?php

declare(strict_types=1);

namespace Voidhash;

use Nyholm\Psr7\Factory\Psr17Factory;
use Psr\Http\Client\ClientInterface;
use Symfony\Component\HttpClient\Psr18Client;
use Symfony\Component\Serializer\SerializerInterface;
use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client as CoreGeneratedClient;
use Voidhash\Generated\EventCapture\Client as EventCaptureGeneratedClient;
use Voidhash\Internal\ApiTransport;
use Voidhash\Internal\ProjectScope;
use Voidhash\Internal\SerializerFactory;
use Voidhash\Resources\ApiKeysResource;
use Voidhash\Resources\AuthResource;
use Voidhash\Resources\EventCaptureResource;
use Voidhash\Resources\NotificationsResource;
use Voidhash\Resources\OrganizationsResource;
use Voidhash\Resources\PaymentSourcesResource;
use Voidhash\Resources\PersonsResource;
use Voidhash\Resources\PaywallsResource;
use Voidhash\Resources\PerksResource;
use Voidhash\Resources\ProductsResource;
use Voidhash\Resources\ProjectsResource;
use Voidhash\Resources\SchemaResource;
use Voidhash\Resources\UsersResource;
use Voidhash\Resources\WebhooksResource;

/**
 * Entry point of the PHP SDK. Create one with {@see VoidhashClient::create()}
 * and use the resource properties:
 *
 *     $client = \Voidhash\VoidhashClient::create('vh_sk_...');
 *     $person = $client->persons->getByDistinctId('user-123');
 */
final class VoidhashClient
{
    public const DEFAULT_BASE_URL = 'https://api.voidhash.com';
    public const DEFAULT_INGEST_URL = 'https://ingest.voidhash.com';

    /** The headers that carry the secret key: management calls, then event capture. */
    private const CREDENTIAL_HEADERS = ['authorization', 'x-secret-key'];

    public readonly AuthResource $auth;
    public readonly ApiKeysResource $apiKeys;
    public readonly PersonsResource $persons;
    public readonly PerksResource $perks;
    public readonly OrganizationsResource $organizations;
    public readonly ProjectsResource $projects;
    public readonly ProductsResource $products;
    public readonly PaywallsResource $paywalls;
    public readonly PaymentSourcesResource $paymentSources;
    public readonly SchemaResource $schema;
    public readonly NotificationsResource $notifications;
    public readonly UsersResource $users;
    public readonly WebhooksResource $webhooks;
    public readonly EventCaptureResource $eventCapture;

    /**
     * The secret key authenticates every resource, event capture included:
     * management calls send it as `Authorization: Bearer`, event capture as
     * `x-secret-key`.
     *
     * Management calls are made in one project. `projectId` names it; without
     * it the client asks the API which project the key belongs to on its first
     * management call and keeps the answer. A credential that can use several
     * projects, such as a CLI key, must set it.
     *
     * `publishableKey` is optional: when set it is echoed as the ingest body
     * `token` the way a browser SDK would send it.
     *
     * @param array{
     *   baseUrl?: string,
     *   ingestUrl?: string,
     *   projectId?: string|null,
     *   publishableKey?: string,
     *   httpClient?: ClientInterface|null,
     *   headers?: array<string, string>
     * } $options
     *
     * @throws ApiException with code `configuration_error` for an empty secret
     *         key or a header that would replace it
     */
    public static function create(string $secretKey, array $options = []): self
    {
        if (trim($secretKey) === '') {
            throw ApiException::configuration('voidhash: a secret key is required');
        }
        foreach (array_keys($options['headers'] ?? []) as $header) {
            if (in_array(strtolower((string) $header), self::CREDENTIAL_HEADERS, true)) {
                throw ApiException::configuration(sprintf('voidhash: the %s header carries the secret key and cannot be set', $header));
            }
        }

        $baseUrl = rtrim($options['baseUrl'] ?? self::DEFAULT_BASE_URL, '/');
        $ingestUrl = rtrim($options['ingestUrl'] ?? self::DEFAULT_INGEST_URL, '/');
        $headers = $options['headers'] ?? [];
        $innerHttpClient = $options['httpClient'] ?? new Psr18Client();
        $factories = new Psr17Factory();

        $coreHttp = new ApiTransport($innerHttpClient, $baseUrl, array_merge($headers, ['Authorization' => 'Bearer ' . $secretKey]));
        $core = new CoreGeneratedClient($coreHttp, $factories, SerializerFactory::core(), $factories);

        // Ingest lives on its own origin and keeps its own credential header.
        $ingestHttp = new ApiTransport($innerHttpClient, $ingestUrl, array_merge($headers, ['x-secret-key' => $secretKey]));
        $eventCapture = new EventCaptureGeneratedClient($ingestHttp, $factories, SerializerFactory::eventCapture(), $factories);

        $projectId = trim($options['projectId'] ?? '');
        $publishableKey = trim($options['publishableKey'] ?? '');

        return new self(
            $core,
            $eventCapture,
            new ProjectScope($core, $projectId === '' ? null : $projectId),
            $publishableKey === '' ? null : $publishableKey,
        );
    }

    private function __construct(
        private readonly CoreGeneratedClient $core,
        private readonly EventCaptureGeneratedClient $eventCaptureGenerated,
        ProjectScope $project,
        ?string $publishableKey,
    ) {
        $this->auth = new AuthResource($this->core);
        $this->apiKeys = new ApiKeysResource($this->core, $project);
        $this->persons = new PersonsResource($this->core, $project);
        $this->perks = new PerksResource($this->core, $project);
        $this->organizations = new OrganizationsResource($this->core);
        $this->projects = new ProjectsResource($this->core);
        $this->products = new ProductsResource($this->core, $project);
        $this->paywalls = new PaywallsResource($this->core, $project);
        $this->paymentSources = new PaymentSourcesResource($this->core, $project);
        $this->schema = new SchemaResource($this->core, $project);
        $this->notifications = new NotificationsResource($this->core, $project);
        $this->users = new UsersResource($this->core);
        $this->webhooks = new WebhooksResource($this->core, $project);
        $this->eventCapture = new EventCaptureResource($this->eventCaptureGenerated, $publishableKey);
    }

    /** @internal exposed for resources that compose other resources. */
    public function core(): CoreGeneratedClient
    {
        return $this->core;
    }
}
