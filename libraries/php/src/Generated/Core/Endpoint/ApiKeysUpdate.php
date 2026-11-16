<?php

namespace Voidhash\Generated\Core\Endpoint;

class ApiKeysUpdate extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $apiKeyId;
    /**
     * Replaces a secret key's project permissions, keeping its secret; `null` gives it full access. The editor must hold every permission the key has before and after the change. Only a person signed in to the Voidhash dashboard can do this; a secret key, a CLI key or an MCP client cannot. Fails with `invalid_request` (`publishable_key_not_editable`) for a publishable key.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $apiKeyId The key's id: `api_sk_...` for a secret key, `api_pk_...` for a publishable key.
     * @param \Voidhash\Generated\Core\Model\UpdateApiKeyBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $apiKeyId, \Voidhash\Generated\Core\Model\UpdateApiKeyBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->apiKeyId = $apiKeyId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{apiKeyId}'], [$this->projectId, $this->apiKeyId], '/api/v1/projects/{projectId}/api-keys/{apiKeyId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdateApiKeyBodyJsonEncoding) {
            return [['Content-Type' => ['application/json']], $serializer->serialize($this->body, 'json')];
        }
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysUpdateInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiKeyJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiKeyJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysUpdateBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysUpdateUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysUpdateForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysUpdateNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysUpdateInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}