<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\SdkEntitlementGrantJsonEncoding;
use Voidhash\Internal\PageCollector;

/**
 * Resolves entitlements for persons. Access it through
 * `$client->persons->entitlements`.
 */
final class EntitlementsResource
{
    public function __construct(private readonly Client $core)
    {
    }

    /** Resolves a person by distinct id and returns their entitlement grants. */
    public function grantsByDistinctId(string $distinctId): array
    {
        try {
            return $this->grantsFor($distinctId);
        } catch (ApiException $e) {
            throw $e;
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }

    /**
     * Reports whether the person holds an active grant for a perk, selected
     * either by `perkId` or `perkSlug` (resolved through the perks list).
     *
     * An unknown distinct id — and an unknown perk slug — resolve to false: a
     * person Voidhash has never seen has no access. Authentication and server
     * failures still throw, so a broken secret key is never mistaken for
     * "no access".
     *
     * @param array{distinctId: string, perkId?: string, perkSlug?: string} $params
     */
    public function hasActivePerk(array $params): bool
    {
        $perkId = trim($params['perkId'] ?? '');
        $perkSlug = trim($params['perkSlug'] ?? '');

        if (($perkId === '') === ($perkSlug === '')) {
            throw new ApiException(0, 'ConfigurationError');
        }

        try {
            if ($perkId === '') {
                $perkId = $this->resolvePerkIdBySlug($perkSlug);
                if ($perkId === null) {
                    return false;
                }
            }

            foreach ($this->grantsFor($params['distinctId']) as $grant) {
                if ($grant->getPerkId() === $perkId && $grant->getStatus() === 'active') {
                    return true;
                }
            }

            return false;
        } catch (ApiException $e) {
            if ($e->getStatus() === 404) {
                return false;
            }
            throw $e;
        }
    }

    /** @return list<SdkEntitlementGrantJsonEncoding> */
    private function grantsFor(string $distinctId): array
    {
        try {
            $person = ($this->core->personsListPersons(['distinctId' => $distinctId])?->getData() ?? [])[0]
                ?? throw new ApiException(404, 'Api/PersonNotFoundError');
            $entitlements = $this->core->personsGetPersonEntitlements($person->getPersonId())
                ?? throw new ApiException(500);
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }

        return $entitlements->getGrants();
    }

    private function resolvePerkIdBySlug(string $slug): ?string
    {
        foreach ($this->listPerks() as $perk) {
            if ($perk->getSlug() === $slug) {
                return $perk->getId();
            }
        }

        return null;
    }

    /** @return list<\Voidhash\Generated\Core\Model\PerkJsonEncoding> */
    private function listPerks(): array
    {
        try {
            return PageCollector::collect(fn (array $query) => $this->core->perksListPerks($query));
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
