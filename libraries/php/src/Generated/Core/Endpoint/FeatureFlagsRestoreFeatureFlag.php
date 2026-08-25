<?php

namespace Voidhash\Generated\Core\Endpoint;

class FeatureFlagsRestoreFeatureFlag extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $featureFlagId;
    /**
     * @param string $featureFlagId
     */
    public function __construct(string $featureFlagId)
    {
        $this->featureFlagId = $featureFlagId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{featureFlagId}'], [$this->featureFlagId], '/api/v1/feature-flags/{featureFlagId}/restore');
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
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding1
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding1', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiFeatureFlagNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}