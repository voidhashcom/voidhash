<?php

namespace Voidhash\Generated\Core\Endpoint;

class WebhooksRotateWebhookSecret extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $endpointId;
    /**
     * @param string $endpointId
     */
    public function __construct(string $endpointId)
    {
        $this->endpointId = $endpointId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{endpointId}'], [$this->endpointId], '/api/v1/webhooks/endpoints/{endpointId}/rotate-secret');
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
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiWebhookEndpointNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}