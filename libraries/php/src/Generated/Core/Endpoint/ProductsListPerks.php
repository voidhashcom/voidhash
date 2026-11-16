<?php

namespace Voidhash\Generated\Core\Endpoint;

class ProductsListPerks extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $productId;
    /**
     * Lists the perks a purchase of the product gives access to.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $productId The product's id, `prod_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $productId, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->productId = $productId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{productId}'], [$this->projectId, $this->productId], '/api/v1/projects/{projectId}/products/{productId}/perks');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    protected function getQueryOptionsResolver(): \Symfony\Component\OptionsResolver\OptionsResolver
    {
        $optionsResolver = parent::getQueryOptionsResolver();
        $optionsResolver->setDefined(['cursor', 'limit']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('cursor', ['string']);
        $optionsResolver->addAllowedTypes('limit', ['int']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\ProductsListPerksBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListPerksUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListPerksForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListPerksNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListPerksInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdProductsProductIdPerksGetResponse200
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdProductsProductIdPerksGetResponse200', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductsListPerksBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductsListPerksUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductsListPerksForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductsListPerksNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ProductsListPerksInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}