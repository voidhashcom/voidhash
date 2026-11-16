<?php

namespace Voidhash\Generated\Core\Endpoint;

class OrganizationsUpdateSettings extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $organizationId;
    /**
     * Changes the settings in the body; settings left out keep their values. Returns every setting. A reporting currency applies to every report from then on, past ranges included. Fails with `invalid_request` (`unsupported_currency`) for a currency without exchange rates back to 2010. A preferred language applies to a bot's next message. Fails with `invalid_request` (`unsupported_language`) for a language Voidhash doesn't offer. Nothing changes when a setting fails. Needs permission to update the organization.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateOrganizationSettingsBodyJsonEncoding $requestBody
     */
    public function __construct(string $organizationId, \Voidhash\Generated\Core\Model\UpdateOrganizationSettingsBodyJsonEncoding $requestBody)
    {
        $this->organizationId = $organizationId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{organizationId}'], [$this->organizationId], '/api/v1/organizations/{organizationId}/settings');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdateOrganizationSettingsBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\OrganizationSettingsJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\OrganizationSettingsJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}