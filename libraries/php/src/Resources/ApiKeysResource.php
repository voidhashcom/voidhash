<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\ApiKeyJsonEncoding;
use Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding;
use Voidhash\Generated\Core\Model\CreateApiKeyBodyJsonEncoding;
use Voidhash\Generated\Core\Model\RotateApiKeyBodyJsonEncoding;
use Voidhash\Internal\PageCollector;
use Voidhash\Internal\ProjectScope;

/**
 * The project's API keys. Creating, deleting and rotating a secret key is
 * reserved to a person signed in to the dashboard, so a secret key or a CLI
 * key gets `permission_denied` for those.
 */
final class ApiKeysResource
{
    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
    ) {
    }

    /** Creates a secret key; the response is the only time its `rawKey` is shown. */
    public function create(CreateApiKeyBodyJsonEncoding $params): ApiKeyWithRawKeyJsonEncoding
    {
        return $this->core->apiKeysCreate($this->project->id(), $params) ?? throw ApiException::unexpectedResponse();
    }

    /** @return list<ApiKeyJsonEncoding> */
    public function list(): array
    {
        $projectId = $this->project->id();

        return PageCollector::collect(fn (array $query) => $this->core->apiKeysList($projectId, $query));
    }

    public function get(string $apiKeyId): ApiKeyJsonEncoding
    {
        return $this->core->apiKeysGet($this->project->id(), $apiKeyId) ?? throw ApiException::unexpectedResponse();
    }

    public function delete(string $apiKeyId): void
    {
        $this->core->apiKeysDelete($this->project->id(), $apiKeyId);
    }

    /**
     * Issues a new secret for a secret key. The previous one stops working at
     * once, or after `overlapSeconds`.
     */
    public function rotate(string $apiKeyId, ?int $overlapSeconds = null): ApiKeyWithRawKeyJsonEncoding
    {
        $body = new RotateApiKeyBodyJsonEncoding();
        if ($overlapSeconds !== null) {
            $body->setOverlapSeconds($overlapSeconds);
        }

        return $this->core->apiKeysRotate($this->project->id(), $apiKeyId, $body) ?? throw ApiException::unexpectedResponse();
    }
}
