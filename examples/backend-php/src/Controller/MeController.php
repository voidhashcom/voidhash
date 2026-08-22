<?php

declare(strict_types=1);

namespace Voidhash\Example\Controller;

use Voidhash\Example\Nimbus\EntitlementCache;
use Voidhash\Example\Nimbus\EntitlementResolver;
use Voidhash\Example\Nimbus\NoteStore;
use Voidhash\Example\Request;
use Voidhash\Example\Response;

final class MeController
{
    public function __construct(
        private readonly EntitlementCache $entitlements,
        private readonly NoteStore $notes,
    ) {
    }

    /**
     * `GET /v1/me?distinctId=…` — the person and their entitlement grants.
     *
     * A distinct id Voidhash has never seen answers 200 with `person: null`
     * and no grants. That is the correct shape for a free user who has not
     * signed in yet, and turning it into a 404 makes every client special-case
     * the most common state in the product.
     */
    public function __invoke(Request $request): Response
    {
        $distinctId = $request->requireDistinctId();
        $entitlements = $this->entitlements->resolve($distinctId);
        $isPro = $entitlements->hasPerk(EntitlementResolver::PRO_PERK_SLUG);
        $noteCount = $this->notes->countFor($distinctId);

        return Response::json(200, [
            'distinctId' => $distinctId,
            'person' => $entitlements->person,
            'plan' => $isPro ? 'pro' : 'free',
            'notesCreated' => $noteCount,
            'perks' => $entitlements->activePerkSlugs(),
            'grants' => $entitlements->grants,
            'freshness' => $entitlements->freshness->value,
        ]);
    }
}
