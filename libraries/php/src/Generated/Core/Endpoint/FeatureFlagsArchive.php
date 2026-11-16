<?php

namespace Voidhash\Generated\Core\Endpoint;

class FeatureFlagsArchive extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $featureFlagId;
    /**
     * Archives a flag: apps stop receiving it and it leaves the flag list, keeping its key. Archiving an archived flag changes nothing. Fails with `conflict` (`feature_flag_managed_by_experiment`) for an experiment's flag.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     */
    public function __construct(string $projectId, string $featureFlagId)
    {
        $this->projectId = $projectId;
        $this->featureFlagId = $featureFlagId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{featureFlagId}'], [$this->projectId, $this->featureFlagId], '/api/v1/projects/{projectId}/feature-flags/{featureFlagId}/archive');
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
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}