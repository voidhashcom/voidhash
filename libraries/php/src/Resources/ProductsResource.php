<?php

namespace Voidhash\Resources;

use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\PerkJsonEncoding;
use Voidhash\Generated\Core\Model\ProductJsonEncoding;
use Voidhash\Internal\PageCollector;
use Voidhash\Internal\ProjectScope;

final class ProductsResource
{
    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
    ) {
    }

    /** @return list<ProductJsonEncoding> */
    public function list(): array
    {
        $projectId = $this->project->id();

        return PageCollector::collect(fn (array $query) => $this->core->productsList($projectId, $query));
    }

    /**
     * The perks a purchase of the product grants.
     *
     * @return list<PerkJsonEncoding>
     */
    public function perksByProduct(string $productId): array
    {
        $projectId = $this->project->id();

        return PageCollector::collect(
            fn (array $query) => $this->core->productsListPerks($projectId, $productId, $query),
        );
    }
}
