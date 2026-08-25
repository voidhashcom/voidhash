<?php

namespace Voidhash\Generated\Core\Endpoint;

class ApiKeysDeleteApiKey extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $apiKeyId;
    /**
     * @param string $apiKeyId
     */
    public function __construct(string $apiKeyId)
    {
        $this->apiKeyId = $apiKeyId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'DELETE';
    }
    public function getUri(): string
    {
        return str_replace(['{apiKeyId}'], [$this->apiKeyId], '/api/v1/api-keys/{apiKeyId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyInternalServerErrorException
     *
     * @return null
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (204 === $status) {
            return null;
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiApiKeyNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}