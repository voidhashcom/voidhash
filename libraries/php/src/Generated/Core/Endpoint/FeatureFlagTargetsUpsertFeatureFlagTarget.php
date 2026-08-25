<?php

namespace Voidhash\Generated\Core\Endpoint;

class FeatureFlagTargetsUpsertFeatureFlagTarget extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    /**
     * @param \Voidhash\Generated\Core\Model\UpsertFeatureFlagTargetBodyJsonEncoding $requestBody
     */
    public function __construct(\Voidhash\Generated\Core\Model\UpsertFeatureFlagTargetBodyJsonEncoding $requestBody)
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
        return '/api/v1/feature-flag-targets';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpsertFeatureFlagTargetBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\FeatureFlagTargetJsonEncoding1
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\FeatureFlagTargetJsonEncoding1', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetNotFoundException($response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}