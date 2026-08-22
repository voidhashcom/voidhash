<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\ProductJsonEncoding;
use Voidhash\Generated\Core\Model\ProductPerkJsonEncoding;

final class ProductsResource
{
    public function __construct(private readonly Client $core)
    {
    }

    /** @return list<ProductJsonEncoding> */
    public function list(): array
    {
        try {
            return $this->core->productsListProducts() ?? [];
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }

    /** @return list<ProductPerkJsonEncoding> */
    public function perksByProduct(string $productId): array
    {
        try {
            return $this->core->productPerksListProductPerksByProductId($productId) ?? [];
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
