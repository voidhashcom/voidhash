<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/** A provider that lists its products, so Voidhash can import them. */
interface CatalogSource
{
    /**
     * Returns one page of products. Pass the page's `nextCursor` back in the
     * next request's cursor; `null` ends the listing.
     *
     * @throws ProviderException to fail with a chosen code and message
     */
    public function listCatalog(CatalogRequest $request): CatalogPage;
}
