<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ClientException;
use Voidhash\Generated\Core\Model\ApiKeyJsonEncoding;
use Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding;
use Voidhash\Generated\Core\Model\CreateSecretKeyBodyJsonEncoding;

final class ApiKeysResource
{
    public function __construct(private readonly Client $core)
    {
    }

    public function create(CreateSecretKeyBodyJsonEncoding $params): ApiKeyWithRawKeyJsonEncoding
    {
        return $this->wrap(fn () => $this->core->apiKeysCreateSecretKey($params));
    }

    /** @return list<ApiKeyJsonEncoding> */
    public function list(): array
    {
        return $this->wrap(fn () => $this->core->apiKeysListApiKeys() ?? []);
    }

    public function get(string $apiKeyId): ?ApiKeyJsonEncoding
    {
        return $this->wrap(fn () => $this->core->apiKeysGetApiKeyById($apiKeyId));
    }

    public function delete(string $apiKeyId): void
    {
        $this->wrap(function () use ($apiKeyId): null {
            $this->core->apiKeysDeleteApiKey($apiKeyId);

            return null;
        });
    }

    public function rotate(string $apiKeyId): ApiKeyWithRawKeyJsonEncoding
    {
        return $this->wrap(fn () => $this->core->apiKeysRotateSecretKey($apiKeyId) ?? throw new ApiException(500));
    }

    /** @template T @param callable(): T $call @return T */
    private function wrap(callable $call): mixed
    {
        try {
            return $call();
        } catch (ClientException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
