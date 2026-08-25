<?php

namespace Voidhash\Generated\Core\Endpoint;

class FeatureFlagOverridesUpsertFeatureFlagOverride extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    /**
     * @param \Voidhash\Generated\Core\Model\UpsertFeatureFlagOverrideBodyJsonEncoding $requestBody
     */
    public function __construct(\Voidhash\Generated\Core\Model\UpsertFeatureFlagOverrideBodyJsonEncoding $requestBody)
    {
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return '/api/v1/feature-flag-overrides';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpsertFeatureFlagOverrideBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding1
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding1', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideNotFoundException($response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}