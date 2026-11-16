<?php

namespace Voidhash\Generated\Core\Endpoint;

class OrganizationMembersUpdate extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $organizationId;
    protected $memberId;
    /**
     * Changes a member's role to `member` or `admin`. The owner's role cannot change here, the last administrator cannot be demoted, and a directory-managed member's role comes from their directory groups. Fails with `permission_denied` (`permission_denied`) for any of these. An app limited to reading cannot change roles.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $memberId The membership's id, `member_...`; not the person's `user_...` id.
     * @param \Voidhash\Generated\Core\Model\UpdateOrganizationMemberBodyJsonEncoding $requestBody
     */
    public function __construct(string $organizationId, string $memberId, \Voidhash\Generated\Core\Model\UpdateOrganizationMemberBodyJsonEncoding $requestBody)
    {
        $this->organizationId = $organizationId;
        $this->memberId = $memberId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{organizationId}', '{memberId}'], [$this->organizationId, $this->memberId], '/api/v1/organizations/{organizationId}/members/{memberId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdateOrganizationMemberBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\OrganizationMemberJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\OrganizationMemberJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}