<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\PersonEntitlementJsonEncoding;
use Voidhash\Internal\PageCollector;
use Voidhash\Internal\ProjectScope;

/**
 * Resolves entitlements for persons. Access it through
 * `$client->persons->entitlements`.
 */
final class EntitlementsResource
{
    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
    ) {
    }

    /**
     * Resolves a person by distinct id and returns their entitlements: one per
     * perk they can use now, including the access of persons merged into them.
     *
     * @return list<PersonEntitlementJsonEncoding>
     *
     * @throws ApiException with code `person_not_found` for a distinct id
     *         Voidhash has never seen
     */
    public function grantsByDistinctId(string $distinctId): array
    {
        $projectId = $this->project->id();
        $persons = $this->core->personsList($projectId, ['distinctId' => $distinctId]) ?? throw ApiException::unexpectedResponse();
        $person = $persons->getData()[0] ?? throw new ApiException(
            404,
            'not_found',
            'person_not_found',
            sprintf('There is no person with the distinct id %s.', $distinctId),
            'distinctId',
        );

        return PageCollector::collect(
            fn (array $query) => $this->core->personsListEntitlements($projectId, $person->getId(), $query),
        );
    }

    /**
     * Reports whether the person can use a perk now, selected either by
     * `perkId` or `perkSlug`.
     *
     * An unknown distinct id — and an unknown perk — resolve to false: a
     * person Voidhash has never seen has no access. Authentication, project
     * and server failures still throw, so a broken secret key is never
     * mistaken for "no access".
     *
     * @param array{distinctId: string, perkId?: string, perkSlug?: string} $params
     */
    public function hasActivePerk(array $params): bool
    {
        $perkId = trim($params['perkId'] ?? '');
        $perkSlug = trim($params['perkSlug'] ?? '');
        if (($perkId === '') === ($perkSlug === '')) {
            throw ApiException::configuration('voidhash: hasActivePerk takes exactly one of perkId or perkSlug');
        }

        try {
            $entitlements = $this->grantsByDistinctId($params['distinctId']);
        } catch (ApiException $e) {
            if ($e->getErrorCode() === 'person_not_found') {
                return false;
            }
            throw $e;
        }

        foreach ($entitlements as $entitlement) {
            if ($perkId !== '' ? $entitlement->getPerkId() === $perkId : $entitlement->getPerkSlug() === $perkSlug) {
                return true;
            }
        }

        return false;
    }
}
