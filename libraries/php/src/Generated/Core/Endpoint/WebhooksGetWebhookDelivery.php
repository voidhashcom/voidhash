<?php

namespace Voidhash\Generated\Core\Endpoint;

class WebhooksGetWebhookDelivery extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $deliveryId;
    /**
     * @param string $deliveryId
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     */
    public function __construct(string $deliveryId, array $queryParameters = [])
    {
        $this->deliveryId = $deliveryId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{deliveryId}'], [$this->deliveryId], '/api/v1/webhooks/deliveries/{deliveryId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    protected function getQueryOptionsResolver(): \Symfony\Component\OptionsResolver\OptionsResolver
    {
        $optionsResolver = parent::getQueryOptionsResolver();
        $optionsResolver->setDefined(['projectId']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('projectId', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiWebhookDeliveryNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}