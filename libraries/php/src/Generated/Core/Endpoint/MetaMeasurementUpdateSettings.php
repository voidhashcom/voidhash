<?php

namespace Voidhash\Generated\Core\Endpoint;

class MetaMeasurementUpdateSettings extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    /**
     * Changes the fields it names; `null` removes one. Secrets are stored encrypted and never returned. Conversions go only for people whose `$ad_data_sharing` trait is `true`, and turning them on sends only purchases made from then on. Fails with `invalid_request` (`conversions_not_configured`) to turn conversions on without both a dataset and a token, and `invalid_request` (`invalid_install_referrer_key`, `invalid_dataset_id`, `invalid_conversions_token` or `invalid_test_event_code`) for a malformed value, with `param` naming the field. Needs `project:ads:manage`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\UpdateMetaMeasurementSettingsBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, \Voidhash\Generated\Core\Model\UpdateMetaMeasurementSettingsBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}'], [$this->projectId], '/api/v1/projects/{projectId}/ads/meta-measurement/settings');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdateMetaMeasurementSettingsBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}