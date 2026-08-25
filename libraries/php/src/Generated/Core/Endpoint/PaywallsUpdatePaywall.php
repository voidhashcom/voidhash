<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallsUpdatePaywall extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $paywallId;
    /**
     * @param string $paywallId
     * @param \Voidhash\Generated\Core\Model\UpdatePaywallBodyJsonEncoding $requestBody
     */
    public function __construct(string $paywallId, \Voidhash\Generated\Core\Model\UpdatePaywallBodyJsonEncoding $requestBody)
    {
        $this->paywallId = $paywallId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{paywallId}'], [$this->paywallId], '/api/v1/paywalls/{paywallId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdatePaywallBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaywallNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}