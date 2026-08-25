<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallsPublishPaywallRelease extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $paywallId;
    protected $releaseId;
    /**
     * @param string $paywallId
     * @param string $releaseId
     */
    public function __construct(string $paywallId, string $releaseId)
    {
        $this->paywallId = $paywallId;
        $this->releaseId = $releaseId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{paywallId}', '{releaseId}'], [$this->paywallId, $this->releaseId], '/api/v1/paywalls/{paywallId}/releases/{releaseId}/publish');
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallReleaseJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallReleaseJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseNotFoundException($response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}