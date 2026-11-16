<?php

namespace Voidhash\Generated\Core\Endpoint;

class ComponentRegistryUpdateVersion extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $registryComponentId;
    protected $versionId;
    /**
     * Deprecates (`status: deprecated`), restores (`ready`) or yanks (`yanked`) a version, with an optional `statusMessage` for installers. Deprecated and yanked versions cannot be newly installed, inserted or published; paywalls already published with them keep working. Only people who may publish paywalls in the owner project, and organization admins, can. Fails with `not_found` (`registry_component_version_not_found`) and `conflict` (`version_yanked`) when restoring or deprecating a yanked version: a yank is final.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $registryComponentId The registry component's id, `cmp_pkg_...`.
     * @param string $versionId The id of the registry component's version, `cmp_pkg_ver_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePublishedComponentVersionBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $registryComponentId, string $versionId, \Voidhash\Generated\Core\Model\UpdatePublishedComponentVersionBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->registryComponentId = $registryComponentId;
        $this->versionId = $versionId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{registryComponentId}', '{versionId}'], [$this->projectId, $this->registryComponentId, $this->versionId], '/api/v1/projects/{projectId}/registry-components/{registryComponentId}/versions/{versionId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdatePublishedComponentVersionBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}