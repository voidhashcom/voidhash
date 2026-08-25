<?php

namespace Voidhash\Generated\Core\Endpoint;

class ProductsAttachProductPerk extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $productId;
    /**
     * @param string $productId
     * @param \Voidhash\Generated\Core\Model\AttachProductPerkBodyJsonEncoding $requestBody
     */
    public function __construct(string $productId, \Voidhash\Generated\Core\Model\AttachProductPerkBodyJsonEncoding $requestBody)
    {
        $this->productId = $productId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{productId}'], [$this->productId], '/api/v1/products/{productId}/perks');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\AttachProductPerkBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkConflictException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ProductPerkJsonEncoding1
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ProductPerkJsonEncoding1', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiProductPerkValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiProductNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiProductPerkAlreadyExistsErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}