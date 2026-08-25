<?php

namespace Voidhash\Generated\Core\Endpoint;

class FeatureFlagsUpdateFeatureFlag extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $featureFlagId;
    /**
     * @param string $featureFlagId
     * @param \Voidhash\Generated\Core\Model\UpdateFeatureFlagBodyJsonEncoding $requestBody
     */
    public function __construct(string $featureFlagId, \Voidhash\Generated\Core\Model\UpdateFeatureFlagBodyJsonEncoding $requestBody)
    {
        $this->featureFlagId = $featureFlagId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{featureFlagId}'], [$this->featureFlagId], '/api/v1/feature-flags/{featureFlagId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdateFeatureFlagBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiFeatureFlagNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}