<?php

namespace Voidhash\Generated\Core\Endpoint;

class ComponentRegistryUpdate extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $registryComponentId;
    /**
     * Deprecates a whole component (no new installs or inserts) with an optional `deprecationMessage`, or lifts it; only people who may publish paywalls in the owner project, and organization admins, can. `ownerProjectId` transfers the component to another project of the organization, whose people who may publish paywalls can then publish, deprecate and yank; only a person who is an organization admin can transfer. Fails with `not_found` (`registry_component_not_found`) and `invalid_request` (`invalid_owner_project`) for an owner project outside the organization, and `invalid_request` (`deprecation_message_without_deprecation`) for a deprecation message without a deprecation.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $registryComponentId The registry component's id, `cmp_pkg_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePublishedComponentBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $registryComponentId, \Voidhash\Generated\Core\Model\UpdatePublishedComponentBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->registryComponentId = $registryComponentId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{registryComponentId}'], [$this->projectId, $this->registryComponentId], '/api/v1/projects/{projectId}/registry-components/{registryComponentId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdatePublishedComponentBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PublishedComponentJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PublishedComponentJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}