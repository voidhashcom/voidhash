<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProviderProductsCreate extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paymentProviderId;
    /**
     * Maps a store product, named by `configuration` as the provider's catalog entry shows, to a product. The mapping is active at once, and purchases of the store product, including ones that waited for a mapping, grant the product's perks. A product sells one store product per provider: the first one mapped, until `sell` chooses another. Its other store products there are not offered to new buyers; people who bought them keep their access and their purchases still count for the product. A store product linked to another product needs `isReassignment: true`, which moves its mapping to this product with everything recorded under it, as `move` does; reassigning a store product already mapped to this product updates that mapping. Fails with `invalid_request` (`invalid_product_mapping`) for a store product linked to another product without `isReassignment`, or one that cannot move to this product. Fails with `not_found` (`payment_provider_not_found`, `product_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param \Voidhash\Generated\Core\Model\CreatePaymentProviderProductMappingBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $paymentProviderId, \Voidhash\Generated\Core\Model\CreatePaymentProviderProductMappingBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->paymentProviderId = $paymentProviderId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paymentProviderId}'], [$this->projectId, $this->paymentProviderId], '/api/v1/projects/{projectId}/payment-providers/{paymentProviderId}/products');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\CreatePaymentProviderProductMappingBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaymentProviderProductMappingJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaymentProviderProductMappingJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}