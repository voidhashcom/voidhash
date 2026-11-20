<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProviderProductsMove extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paymentProviderId;
    protected $mappingId;
    /**
     * Moves the mapping to another product of the project, keeping its id: the purchases, subscriptions and revenue recorded under the store product move with it, so reports by product change and totals do not. Its buyers get the target product's perks instead of the current product's. The target is sold as the store product unless it is already sold as another one of this provider; the current product, if it was sold as this one, is then sold as its most recently mapped remaining store product. Moving it to the product it already belongs to changes nothing, so a retried move succeeds. `explain-move` shows the impact first. Fails with `invalid_request` (`product_type_mismatch`, `product_duration_mismatch`) for a product of another type or renewal period. Fails with `conflict` (`store_product_already_mapped`) when the target already has an active mapping of the store product, and `conflict` (`target_mapping_has_purchases`) when it has an earlier one with purchases recorded under it. Fails with `conflict` (`revenue_history_not_ready`) for a project whose revenue history has to be prepared before store products can move. Fails with `not_found` (`product_mapping_not_found`, `product_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $mappingId The mapping's id, `pp_prod_...`.
     * @param \Voidhash\Generated\Core\Model\MovePaymentProviderProductMappingBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $paymentProviderId, string $mappingId, \Voidhash\Generated\Core\Model\MovePaymentProviderProductMappingBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->paymentProviderId = $paymentProviderId;
        $this->mappingId = $mappingId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paymentProviderId}', '{mappingId}'], [$this->projectId, $this->paymentProviderId, $this->mappingId], '/api/v1/projects/{projectId}/payment-providers/{paymentProviderId}/products/{mappingId}/move');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\MovePaymentProviderProductMappingBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaymentProviderProductMappingJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaymentProviderProductMappingJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderProductsMoveInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}