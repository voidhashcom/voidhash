<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallLocationsUpdatePaywallLocation extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $locationId;
    /**
     * @param string $locationId
     * @param \Voidhash\Generated\Core\Model\UpdatePaywallLocationBodyJsonEncoding $requestBody
     */
    public function __construct(string $locationId, \Voidhash\Generated\Core\Model\UpdatePaywallLocationBodyJsonEncoding $requestBody)
    {
        $this->locationId = $locationId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{locationId}'], [$this->locationId], '/api/v1/paywall-locations/{locationId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdatePaywallLocationBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaywallLocationNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}