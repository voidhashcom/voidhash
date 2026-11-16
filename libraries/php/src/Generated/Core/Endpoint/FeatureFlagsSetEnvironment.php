<?php

namespace Voidhash\Generated\Core\Endpoint;

class FeatureFlagsSetEnvironment extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $featureFlagId;
    protected $environment;
    /**
     * Replaces who gets the flag in one environment: its switch, overrides, rules and fallthrough, read in that order. Setting `test` gives test a configuration of its own; until then it follows production. Fails with `invalid_request` (`invalid_environment`) when a variant named is not one of the flag's, or an end user or rule id is listed twice, and with `conflict` (`feature_flag_managed_by_experiment`) for an experiment's flag.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param string $environment The environment whose configuration is meant: `production`, or `test`, which a test key reads.
     * @param \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $featureFlagId, string $environment, \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->featureFlagId = $featureFlagId;
        $this->environment = $environment;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{featureFlagId}', '{environment}'], [$this->projectId, $this->featureFlagId, $this->environment], '/api/v1/projects/{projectId}/feature-flags/{featureFlagId}/environments/{environment}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}