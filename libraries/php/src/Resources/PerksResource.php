<?php

namespace Voidhash\Resources;

use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\PerkJsonEncoding;
use Voidhash\Internal\PageCollector;
use Voidhash\Internal\ProjectScope;

final class PerksResource
{
    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
    ) {
    }

    /** @return list<PerkJsonEncoding> */
    public function list(): array
    {
        $projectId = $this->project->id();

        return PageCollector::collect(fn (array $query) => $this->core->perksList($projectId, $query));
    }
}
