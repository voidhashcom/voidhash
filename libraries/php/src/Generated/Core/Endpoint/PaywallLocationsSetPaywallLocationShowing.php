<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallLocationsSetPaywallLocationShowing extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $locationId;
    /**
     * @param string $locationId
     * @param \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding $requestBody
     */
    public function __construct(string $locationId, \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding $requestBody)
    {
        $this->locationId = $locationId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{locationId}'], [$this->locationId], '/api/v1/paywall-locations/{locationId}/showing');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaywallLocationShowingValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingNotFoundException($response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}