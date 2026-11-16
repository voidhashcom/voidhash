<?php

namespace Voidhash\Generated\Core\Endpoint;

class ComponentRegistryCreateVersionFromBundle extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    /**
     * Publishes a component bundle as a new version, creating the registry component, owned by this project, on its first version. The bundle must pass the automated checks: the definition schema, the module and its agreement with the definition, size limits, the panel module when the definition declares one, and the conformance suite. Fails with `invalid_request` (`conformance_failed`) when the conformance suite fails, and `invalid_request` (`invalid_bundle`) when another check fails. Only people who may publish paywalls in the owner project, and organization admins, can publish versions of an existing component. Publishing the same bundle again returns the existing version. Fails with `conflict` (`publisher_required`) before a namespace is claimed, `conflict` (`version_already_published`) when the version exists with other contents, and `unavailable` (`component_checks_unavailable`) when the conformance checks could not run.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePublishedComponentBundleVersionBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, \Voidhash\Generated\Core\Model\CreatePublishedComponentBundleVersionBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}'], [$this->projectId], '/api/v1/projects/{projectId}/registry-components/bundles');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\CreatePublishedComponentBundleVersionBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}