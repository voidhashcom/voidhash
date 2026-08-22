<?php

namespace Voidhash\Generated\Core\Endpoint;

class ProductPerksListProductPerksByProductId extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $productId;
    /**
     * @param string $productId
     */
    public function __construct(string $productId)
    {
        $this->productId = $productId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{productId}'], [$this->productId], '/api/v1/product-perks/by-product-id/{productId}');
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
     * @throws \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ProductPerkJsonEncoding[]
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ProductPerkJsonEncoding[]', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiProductPerkValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}