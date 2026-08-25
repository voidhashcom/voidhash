<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProviderProductsUpdatePaymentProviderProduct extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $mappingId;
    /**
     * @param string $mappingId
     * @param \Voidhash\Generated\Core\Model\UpdatePaymentProviderProductBody $requestBody
     */
    public function __construct(string $mappingId, \Voidhash\Generated\Core\Model\UpdatePaymentProviderProductBody $requestBody)
    {
        $this->mappingId = $mappingId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{mappingId}'], [$this->mappingId], '/api/v1/payment-provider-products/{mappingId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdatePaymentProviderProductBody) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaymentProviderProductSummary
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaymentProviderProductSummary', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderProductValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderProductNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}