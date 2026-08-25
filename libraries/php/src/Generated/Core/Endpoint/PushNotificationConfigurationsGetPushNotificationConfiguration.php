<?php

namespace Voidhash\Generated\Core\Endpoint;

class PushNotificationConfigurationsGetPushNotificationConfiguration extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $configurationId;
    /**
     * @param string $configurationId
     */
    public function __construct(string $configurationId)
    {
        $this->configurationId = $configurationId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{configurationId}'], [$this->configurationId], '/api/v1/push-notification-configurations/{configurationId}');
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
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PushNotificationConfigurationSummary
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PushNotificationConfigurationSummary', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}