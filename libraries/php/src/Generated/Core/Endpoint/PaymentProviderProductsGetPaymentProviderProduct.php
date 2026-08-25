<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProviderProductsGetPaymentProviderProduct extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $mappingId;
    /**
     * @param string $mappingId
     */
    public function __construct(string $mappingId)
    {
        $this->mappingId = $mappingId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{mappingId}'], [$this->mappingId], '/api/v1/payment-provider-products/{mappingId}');
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
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderProductValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderProductNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}