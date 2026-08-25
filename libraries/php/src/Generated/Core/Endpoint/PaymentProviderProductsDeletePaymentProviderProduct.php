<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProviderProductsDeletePaymentProviderProduct extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
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
        return 'DELETE';
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
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductInternalServerErrorException
     *
     * @return null
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (204 === $status) {
            return null;
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderProductValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}