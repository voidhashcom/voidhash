<?php

namespace Voidhash\Generated\Core\Endpoint;

class PushNotificationConfigurationsUpdate extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $configurationId;
    /**
     * Renames, enables or disables a push notification configuration, or changes its settings. Fields left out of `configuration`, credentials included, keep their stored values, so a provider can be enabled without sending its credential again. Enabling validates the settings, while a disabled configuration saves incomplete settings. Fails with `invalid_request` (`invalid_push_notification_configuration`) when enabling with incomplete settings. Fails with `conflict` (`push_notification_configuration_key_taken`) when another configuration of the project uses the same credentials. The last update wins.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $configurationId The configuration's id, `push_conf_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $configurationId, \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
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
        return str_replace(['{projectId}', '{configurationId}'], [$this->projectId, $this->configurationId], '/api/v1/projects/{projectId}/push-notification-configurations/{configurationId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PushNotificationConfigurationJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PushNotificationConfigurationJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}