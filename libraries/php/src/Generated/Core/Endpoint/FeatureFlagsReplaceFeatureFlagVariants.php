<?php

namespace Voidhash\Generated\Core\Endpoint;

class FeatureFlagsReplaceFeatureFlagVariants extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $featureFlagId;
    /**
     * @param string $featureFlagId
     * @param \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncoding $requestBody
     */
    public function __construct(string $featureFlagId, \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncoding $requestBody)
    {
        $this->featureFlagId = $featureFlagId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{featureFlagId}'], [$this->featureFlagId], '/api/v1/feature-flags/{featureFlagId}/variants');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiFeatureFlagNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}