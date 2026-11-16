<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/** One page of products, at most 1000; `nextCursor` is `null` on the last page. */
final readonly class CatalogPage
{
    /** @param list<CatalogProduct> $items */
    public function __construct(
        public array $items,
        public ?string $nextCursor = null,
    ) {
    }
}
