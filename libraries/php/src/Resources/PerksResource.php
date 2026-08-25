<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\PerkJsonEncoding;
use Voidhash\Internal\PageCollector;

final class PerksResource
{
    public function __construct(private readonly Client $core)
    {
    }

    /** @return list<PerkJsonEncoding> */
    public function list(): array
    {
        try {
            return PageCollector::collect(fn (array $query) => $this->core->perksListPerks($query));
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
