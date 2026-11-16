<?php

namespace Voidhash\Generated\Core\Endpoint;

class FeatureFlagsListOverrides extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $featureFlagId;
    /**
     * Lists the end users the flag is fixed on or off for in an `environment`, whatever its rules say. Test's are production's while test follows it.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "environment"?: string, //The environment whose overrides are meant: `production`, the default, or `test`. Setting or removing one in `test` gives test a configuration of its own, started from production's.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $featureFlagId, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->featureFlagId = $featureFlagId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{featureFlagId}'], [$this->projectId, $this->featureFlagId], '/api/v1/projects/{projectId}/feature-flags/{featureFlagId}/overrides');
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
        $optionsResolver->setDefined(['cursor', 'limit', 'environment']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('cursor', ['string']);
        $optionsResolver->addAllowedTypes('limit', ['int']);
        $optionsResolver->addAllowedTypes('environment', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdOverridesGetResponse200
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdOverridesGetResponse200', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}