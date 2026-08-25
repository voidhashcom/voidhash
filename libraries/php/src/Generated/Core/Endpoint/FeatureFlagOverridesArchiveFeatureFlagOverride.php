<?php

namespace Voidhash\Generated\Core\Endpoint;

class FeatureFlagOverridesArchiveFeatureFlagOverride extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $overrideId;
    /**
     * @param string $overrideId
     */
    public function __construct(string $overrideId)
    {
        $this->overrideId = $overrideId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'DELETE';
    }
    public function getUri(): string
    {
        return str_replace(['{overrideId}'], [$this->overrideId], '/api/v1/feature-flag-overrides/{overrideId}');
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
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideInternalServerErrorException
     *
     * @return null
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (204 === $status) {
            return null;
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiFeatureFlagOverrideNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}