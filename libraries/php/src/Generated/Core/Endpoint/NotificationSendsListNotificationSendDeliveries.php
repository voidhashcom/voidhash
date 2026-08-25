<?php

namespace Voidhash\Generated\Core\Endpoint;

class NotificationSendsListNotificationSendDeliveries extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $sendId;
    /**
     * @param string $sendId
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "projectId"?: string,
     *    "status"?: string,
     * } $queryParameters
     */
    public function __construct(string $sendId, array $queryParameters = [])
    {
        $this->sendId = $sendId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{sendId}'], [$this->sendId], '/api/v1/notification-sends/{sendId}/deliveries');
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
        $optionsResolver->setDefined(['cursor', 'limit', 'projectId', 'status']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('cursor', ['string']);
        $optionsResolver->addAllowedTypes('limit', ['string']);
        $optionsResolver->addAllowedTypes('projectId', ['string']);
        $optionsResolver->addAllowedTypes('status', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiV1NotificationSendsSendIdDeliveriesGetResponse200
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiV1NotificationSendsSendIdDeliveriesGetResponse200', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPushNotificationSendNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}