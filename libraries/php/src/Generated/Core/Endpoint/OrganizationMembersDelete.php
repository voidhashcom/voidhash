<?php

namespace Voidhash\Generated\Core\Endpoint;

class OrganizationMembersDelete extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $organizationId;
    protected $memberId;
    /**
     * Removes a member from the organization. Fails with `permission_denied` (`permission_denied`) for the owner, the last administrator and directory-managed members, who cannot be removed. An app limited to reading cannot remove members.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $memberId The membership's id, `member_...`; not the person's `user_...` id.
     */
    public function __construct(string $organizationId, string $memberId)
    {
        $this->organizationId = $organizationId;
        $this->memberId = $memberId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'DELETE';
    }
    public function getUri(): string
    {
        return str_replace(['{organizationId}', '{memberId}'], [$this->organizationId, $this->memberId], '/api/v1/organizations/{organizationId}/members/{memberId}');
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
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteInternalServerErrorException
     *
     * @return null
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (204 === $status) {
            return null;
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}