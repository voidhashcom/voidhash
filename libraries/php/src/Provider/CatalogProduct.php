<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/** A product the provider sells; `key` is the product key its payments name. */
final readonly class CatalogProduct
{
    public function __construct(
        public string $key,
        public string $name,
        public ProductKind $kind,
    ) {
    }
}
