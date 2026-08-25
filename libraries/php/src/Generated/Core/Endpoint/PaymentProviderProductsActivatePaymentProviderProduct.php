<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProviderProductsActivatePaymentProviderProduct extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
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
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{mappingId}'], [$this->mappingId], '/api/v1/payment-provider-products/{mappingId}/activate');
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
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderProductValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderProductNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}