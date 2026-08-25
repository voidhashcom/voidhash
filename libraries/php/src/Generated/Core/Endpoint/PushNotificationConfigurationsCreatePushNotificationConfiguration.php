<?php

namespace Voidhash\Generated\Core\Endpoint;

class PushNotificationConfigurationsCreatePushNotificationConfiguration extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    /**
     * @param \Voidhash\Generated\Core\Model\CreatePushNotificationConfigurationBody $requestBody
     */
    public function __construct(\Voidhash\Generated\Core\Model\CreatePushNotificationConfigurationBody $requestBody)
    {
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return '/api/v1/push-notification-configurations';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\CreatePushNotificationConfigurationBody) {
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
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationConflictException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsPostResponse201
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsPostResponse201', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}