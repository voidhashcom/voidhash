<?php

namespace Voidhash\Generated\Core\Endpoint;

class PersonsRevokeGrant extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $personId;
    protected $grantId;
    /**
     * Revokes a grant, so the access it gave ends now. Purchases and subscriptions of the same perk keep giving it. Revoking a revoked grant answers it unchanged. A secret key revokes only its own environment's grants. Fails with `not_found` (`grant_not_found`) when the person has no such grant, and `not_found` (`person_not_found`) for an unknown or erased person.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $personId The person's id, `person_...`. The id of a person merged into another names the person they were merged into.
     * @param string $grantId The grant's id, `grant_...`.
     */
    public function __construct(string $projectId, string $personId, string $grantId)
    {
        $this->projectId = $projectId;
        $this->personId = $personId;
        $this->grantId = $grantId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{personId}', '{grantId}'], [$this->projectId, $this->personId, $this->grantId], '/api/v1/projects/{projectId}/persons/{personId}/grants/{grantId}/revoke');
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
     * @throws \Voidhash\Generated\Core\Exception\PersonsRevokeGrantBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsRevokeGrantUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsRevokeGrantForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsRevokeGrantNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsRevokeGrantInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PersonGrantJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PersonGrantJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsRevokeGrantBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsRevokeGrantUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsRevokeGrantForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsRevokeGrantNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsRevokeGrantInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}