<?php

namespace Voidhash\Generated\Core\Endpoint;

class ComponentRegistryGetInstallReview extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $registryComponentId;
    /**
     * Shows what installing the component into the project, or updating its install, would do: the version the range resolves to, the capabilities it adds, and the props and events it adds, removes or changes. Nothing changes. Fails with `invalid_request` (`invalid_version_range`) and `conflict` (`no_matching_version`, `no_installable_version`, `registry_component_deprecated`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $registryComponentId The registry component's id, `cmp_pkg_...`.
     * @param array{
     *    "versionRange"?: string, //The version range to review: `*`, an exact version such as `1.2.0`, `^1.2.0` (same major version) or `~1.2.0` (same minor version). Defaults to the install's range, or for a new install `^` the newest ready version.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $registryComponentId, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->registryComponentId = $registryComponentId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{registryComponentId}'], [$this->projectId, $this->registryComponentId], '/api/v1/projects/{projectId}/registry-components/{registryComponentId}/install-review');
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
        $optionsResolver->setDefined(['versionRange']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('versionRange', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PublishedComponentInstallReviewJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PublishedComponentInstallReviewJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}