<?php

namespace Voidhash\Generated\Core\Endpoint;

class ComponentsGetVersion extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $componentId;
    protected $versionId;
    /**
     * Reads one version with its build status, build log and, for Rust sources, its crate files. Versions stay readable after their component is deleted, since published paywalls may still embed them. Fails with `not_found` (`component_version_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $componentId The component's id, `cmp_...`.
     * @param string $versionId The id of the component's version, `cmp_ver_...`.
     */
    public function __construct(string $projectId, string $componentId, string $versionId)
    {
        $this->projectId = $projectId;
        $this->componentId = $componentId;
        $this->versionId = $versionId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{componentId}', '{versionId}'], [$this->projectId, $this->componentId, $this->versionId], '/api/v1/projects/{projectId}/components/{componentId}/versions/{versionId}');
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
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetVersionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetVersionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetVersionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetVersionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetVersionInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallComponentVersionDetailJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallComponentVersionDetailJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentsGetVersionBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentsGetVersionUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentsGetVersionForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentsGetVersionNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentsGetVersionInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}