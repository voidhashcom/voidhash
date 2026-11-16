<?php

namespace Voidhash\Generated\Core\Endpoint;

class OrganizationInvitationsCreate extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $organizationId;
    /**
     * Invites an email address to join as a `member` (the default) or `admin`, and emails them the link, which this response also returns. Inviting an address again replaces its pending invitation. Fails with `conflict` (`already_member`) when that person already belongs to the organization, and with `rate_limited` (`invitation_limit_reached`) once the organization sent 50 invitations, or you sent 100, in the last 24 hours; revoked invitations count. An app limited to reading cannot invite.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\CreateOrganizationInvitationBodyJsonEncoding $requestBody
     */
    public function __construct(string $organizationId, \Voidhash\Generated\Core\Model\CreateOrganizationInvitationBodyJsonEncoding $requestBody)
    {
        $this->organizationId = $organizationId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{organizationId}'], [$this->organizationId], '/api/v1/organizations/{organizationId}/invitations');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\CreateOrganizationInvitationBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateTooManyRequestsException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\OrganizationInvitationWithUrlJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\OrganizationInvitationWithUrlJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (429 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateTooManyRequestsException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\RateLimitedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}