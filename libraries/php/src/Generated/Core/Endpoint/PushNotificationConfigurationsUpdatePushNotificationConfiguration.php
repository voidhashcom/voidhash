<?php

namespace Voidhash\Generated\Core\Endpoint;

class PushNotificationConfigurationsUpdatePushNotificationConfiguration extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $configurationId;
    /**
     * @param string $configurationId
     * @param \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBody $requestBody
     */
    public function __construct(string $configurationId, \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBody $requestBody)
    {
        $this->configurationId = $configurationId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{configurationId}'], [$this->configurationId], '/api/v1/push-notification-configurations/{configurationId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBody) {
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
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationConflictException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationInternalServerErrorException
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
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}