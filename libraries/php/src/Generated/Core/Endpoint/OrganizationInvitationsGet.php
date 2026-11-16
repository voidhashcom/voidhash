<?php

namespace Voidhash\Generated\Core\Endpoint;

class OrganizationInvitationsGet extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $organizationId;
    protected $invitationId;
    /**
     * Reads one pending invitation. Fails with `not_found` (`invitation_not_found`) once it is accepted, revoked or expired, or once whoever sent it can no longer invite people to the organization.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $invitationId The invitation's id, `inv_...`.
     */
    public function __construct(string $organizationId, string $invitationId)
    {
        $this->organizationId = $organizationId;
        $this->invitationId = $invitationId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{organizationId}', '{invitationId}'], [$this->organizationId, $this->invitationId], '/api/v1/organizations/{organizationId}/invitations/{invitationId}');
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
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\OrganizationInvitationJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\OrganizationInvitationJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}