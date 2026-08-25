<?php

namespace Voidhash\Generated\Core\Endpoint;

class FeatureFlagsGetFeatureFlag extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
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
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{featureFlagId}'], [$this->featureFlagId], '/api/v1/feature-flags/{featureFlagId}');
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
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiFeatureFlagNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}