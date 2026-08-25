<?php

namespace Voidhash\Generated\Core\Endpoint;

class WebhooksRetryWebhookDelivery extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
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
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{deliveryId}'], [$this->deliveryId], '/api/v1/webhooks/deliveries/{deliveryId}/retry');
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
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiWebhookValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiWebhookDeliveryNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}