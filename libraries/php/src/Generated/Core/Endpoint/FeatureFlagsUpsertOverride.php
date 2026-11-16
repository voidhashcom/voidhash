<?php

namespace Voidhash\Generated\Core\Endpoint;

class FeatureFlagsUpsertOverride extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $featureFlagId;
    protected $identity;
    /**
     * Fixes the flag on or off for one end user, `{identityType}:{identityValue}` in the path, in an `environment`, optionally in one variant by its `variantKey`, whatever the rules say. Replaces the end user's override there, answering 201 when there was none. In `test` it gives test a configuration of its own, started from production's. Works on an experiment's flag in `production`, to put a tester in an arm. Fails with `invalid_request` (`unknown_variant`) when the flag has no such variant, `invalid_request` (`variant_requires_enabled`) for a variant with `isEnabled: false`, and `conflict` (`feature_flag_managed_by_experiment`) for an experiment's flag in `test`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param string $identity The end user, as `{identityType}:{identityValue}` with the value percent-encoded, such as `email:alice@example.com`.
     * @param \Voidhash\Generated\Core\Model\PutFeatureFlagOverrideBodyJsonEncoding $requestBody
     * @param array{
     *    "environment"?: string, //The environment whose overrides are meant: `production`, the default, or `test`. Setting or removing one in `test` gives test a configuration of its own, started from production's.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $featureFlagId, string $identity, \Voidhash\Generated\Core\Model\PutFeatureFlagOverrideBodyJsonEncoding $requestBody, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->featureFlagId = $featureFlagId;
        $this->identity = $identity;
        $this->body = $requestBody;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{featureFlagId}', '{identity}'], [$this->projectId, $this->featureFlagId, $this->identity], '/api/v1/projects/{projectId}/feature-flags/{featureFlagId}/overrides/{identity}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\PutFeatureFlagOverrideBodyJsonEncoding) {
            return [['Content-Type' => ['application/json']], $serializer->serialize($this->body, 'json')];
        }
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    protected function getQueryOptionsResolver(): \Symfony\Component\OptionsResolver\OptionsResolver
    {
        $optionsResolver = parent::getQueryOptionsResolver();
        $optionsResolver->setDefined(['environment']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('environment', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}