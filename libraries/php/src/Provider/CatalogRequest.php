<?php

declare(strict_types=1);

namespace Voidhash\Provider;

use Voidhash\PaymentSources\Environment;

/** Asks for a page of products; `cursor` is `null` for the first page. */
final readonly class CatalogRequest
{
    public function __construct(
        public ?string $cursor,
        public Environment $environment = Environment::Production,
    ) {
    }
}
