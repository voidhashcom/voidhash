<?php

namespace Voidhash\Resources;

use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding;
use Voidhash\Internal\PageCollector;
use Voidhash\Internal\ProjectScope;

final class PaywallsResource
{
    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
    ) {
    }

    /** @return list<PaywallLocationJsonEncoding> */
    public function locations(): array
    {
        $projectId = $this->project->id();

        return PageCollector::collect(fn (array $query) => $this->core->paywallLocationsList($projectId, $query));
    }
}
