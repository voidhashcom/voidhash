<?php

namespace Voidhash\Generated\Core\Endpoint;

class ComponentRegistryGetVersionFile extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $registryComponentId;
    protected $file;
    /**
     * Reads a file the version `versionId` ships, base64 encoded: its `icon`, a preview `thumbnail` (`state` names which), its `readme` or its `agent_guide`. Fails with `not_found` (`registry_component_version_not_found`), and `not_found` (`registry_component_file_not_found`) when the version has no such file.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $registryComponentId The registry component's id, `cmp_pkg_...`.
     * @param string $file Which file to read: `icon`, `thumbnail`, `readme` or `agent_guide`.
     * @param array{
     *    "versionId": string, //The id of the version whose file to read, `cmp_pkg_ver_...`.
     *    "state"?: string, //For a `thumbnail`, the preview state it shows; one of the version's `thumbnailStates`.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $registryComponentId, string $file, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->registryComponentId = $registryComponentId;
        $this->file = $file;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{registryComponentId}', '{file}'], [$this->projectId, $this->registryComponentId, $this->file], '/api/v1/projects/{projectId}/registry-components/{registryComponentId}/files/{file}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    protected function getQueryOptionsResolver(): \Symfony\Component\OptionsResolver\OptionsResolver
    {
        $optionsResolver = parent::getQueryOptionsResolver();
        $optionsResolver->setDefined(['versionId', 'state']);
        $optionsResolver->setRequired(['versionId']);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('versionId', ['string']);
        $optionsResolver->addAllowedTypes('state', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PublishedComponentFileJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PublishedComponentFileJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}