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
use Voidhash\Internal\BaseUriHttpClient;
use Voidhash\Internal\SerializerFactory;
use Voidhash\Resources\ApiKeysResource;
use Voidhash\Resources\AuthResource;
use Voidhash\Resources\EventCaptureResource;
use Voidhash\Resources\NotificationsResource;
use Voidhash\Resources\OrganizationsResource;
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

    private const SECRET_KEY_HEADER = 'x-secret-key';

    public readonly AuthResource $auth;
    public readonly ApiKeysResource $apiKeys;
    public readonly PersonsResource $persons;
    public readonly PerksResource $perks;
    public readonly OrganizationsResource $organizations;
    public readonly ProjectsResource $projects;
    public readonly ProductsResource $products;
    public readonly PaywallsResource $paywalls;
    public readonly SchemaResource $schema;
    public readonly NotificationsResource $notifications;
    public readonly UsersResource $users;
    public readonly WebhooksResource $webhooks;
    public readonly EventCaptureResource $eventCapture;

    /**
     * The secret key authenticates every resource, event capture included.
     * `publishableKey` is optional: when set it is echoed as the ingest body
     * `token` the way a browser SDK would send it.
     *
     * @param array{
     *   baseUrl?: string,
     *   ingestUrl?: string,
     *   publishableKey?: string,
     *   httpClient?: ClientInterface|null,
     *   headers?: array<string, string>
     * } $options
     */
    public static function create(string $secretKey, array $options = []): self
    {
        if (trim($secretKey) === '') {
            throw new ApiException(0, 'ConfigurationError', null);
        }
        foreach (array_keys($options['headers'] ?? []) as $header) {
            if (strcasecmp((string) $header, self::SECRET_KEY_HEADER) === 0) {
                throw new ApiException(0, 'ConfigurationError', null);
            }
        }

        $baseUrl = rtrim($options['baseUrl'] ?? self::DEFAULT_BASE_URL, '/');
        $ingestUrl = rtrim($options['ingestUrl'] ?? self::DEFAULT_INGEST_URL, '/');
        $headers = array_merge($options['headers'] ?? [], [self::SECRET_KEY_HEADER => $secretKey]);

        $innerHttpClient = $options['httpClient'] ?? new Psr18Client();
        $factories = new Psr17Factory();

        $coreHttp = new BaseUriHttpClient($innerHttpClient, $baseUrl, $headers);
        $core = new CoreGeneratedClient($coreHttp, $factories, SerializerFactory::core(), $factories);

        // Ingest lives on its own origin, so it gets its own transport — but it
        // carries the same `x-secret-key` credential as the core API.
        $ingestHttp = new BaseUriHttpClient($innerHttpClient, $ingestUrl, $headers);
        $eventCapture = new EventCaptureGeneratedClient($ingestHttp, $factories, SerializerFactory::eventCapture(), $factories);

        $publishableKey = trim($options['publishableKey'] ?? '');

        return new self($core, $eventCapture, $publishableKey === '' ? null : $publishableKey);
    }

    private function __construct(
        private readonly CoreGeneratedClient $core,
        private readonly EventCaptureGeneratedClient $eventCaptureGenerated,
        ?string $publishableKey,
    ) {
        $this->auth = new AuthResource($this->core);
        $this->apiKeys = new ApiKeysResource($this->core);
        $this->persons = new PersonsResource($this->core);
        $this->perks = new PerksResource($this->core);
        $this->organizations = new OrganizationsResource($this->core);
        $this->projects = new ProjectsResource($this->core);
        $this->products = new ProductsResource($this->core);
        $this->paywalls = new PaywallsResource($this->core);
        $this->schema = new SchemaResource($this->core);
        $this->notifications = new NotificationsResource($this->core);
        $this->users = new UsersResource($this->core);
        $this->webhooks = new WebhooksResource($this->core);
        $this->eventCapture = new EventCaptureResource($this->eventCaptureGenerated, $publishableKey);
    }

    /** @internal exposed for resources that compose other resources. */
    public function core(): CoreGeneratedClient
    {
        return $this->core;
    }
}
