<?php

namespace Voidhash\Generated\Core\Endpoint;

class ApiKeysRotate extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $apiKeyId;
    /**
     * Issues a new secret for a secret key, keeping its id, name, permissions and expiry, and returns it in `rawKey`, shown only this once. The previous secret stops working at once, or after `overlapSeconds`. Only a person signed in to the Voidhash dashboard can do this; a secret key, a CLI key or an MCP client cannot. Fails with `invalid_request` (`publishable_key_not_editable`) for a publishable key.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $apiKeyId The key's id: `api_sk_...` for a secret key, `api_pk_...` for a publishable key.
     * @param \Voidhash\Generated\Core\Model\RotateApiKeyBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $apiKeyId, \Voidhash\Generated\Core\Model\RotateApiKeyBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->apiKeyId = $apiKeyId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{apiKeyId}'], [$this->projectId, $this->apiKeyId], '/api/v1/projects/{projectId}/api-keys/{apiKeyId}/rotate');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\RotateApiKeyBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysRotateBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysRotateUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysRotateForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysRotateNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysRotateInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}