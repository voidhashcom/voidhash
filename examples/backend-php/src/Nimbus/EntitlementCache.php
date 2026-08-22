<?php

declare(strict_types=1);

namespace Voidhash\Example\Nimbus;

use Voidhash\Example\Exception\VoidhashUnavailableException;
use Voidhash\Example\Logger;

/**
 * A 60 second cache in front of the entitlement check, and the outage policy
 * that goes with it.
 *
 * Two rules earn their keep here:
 *
 * 1. Inside the TTL, answer from the cache. Every note listing and every note
 *    creation asks "is this person Pro?", and none of them should cost three
 *    round trips to Voidhash.
 * 2. When Voidhash is unreachable, serve the last known answer past its TTL
 *    ({@see Freshness::Stale}) instead of downgrading someone who paid. If
 *    there is nothing cached the answer is {@see Freshness::Unknown} and is
 *    deliberately *not* written to the cache — caching an outage would turn a
 *    30 second blip into a 60 second one for every affected person.
 */
final class EntitlementCache
{
    public const TTL_SECONDS = 60;

    /** Entries are refreshed after the TTL and dropped entirely after a day, so the file cannot grow forever. */
    private const MAX_AGE_SECONDS = 86400;

    public function __construct(
        private readonly StateFile $state,
        private readonly EntitlementResolver $resolver,
        private readonly Logger $logger,
    ) {
    }

    /**
     * Resolves entitlements for a distinct id, refreshing them when the cached
     * copy is older than {@see EntitlementCache::TTL_SECONDS}.
     *
     * @throws \Voidhash\Exception\ApiException for failures that are not an
     *         outage, such as a rejected secret key
     */
    public function resolve(string $distinctId): Entitlements
    {
        $entry = $this->entry($distinctId);
        $now = time();

        if ($entry !== null && $now - $entry['storedAt'] < self::TTL_SECONDS) {
            return Entitlements::fromArray($entry['data'], Freshness::Cached);
        }

        try {
            $fresh = $this->resolver->fetch($distinctId);
            $this->store($distinctId, $fresh, $now);

            return $fresh;
        } catch (VoidhashUnavailableException $exception) {
            $this->logger->warning('entitlement refresh failed, degrading', [
                'distinctId' => $distinctId,
                'servedFrom' => $entry === null ? Freshness::Unknown->value : Freshness::Stale->value,
                'cause' => $exception->getMessage(),
            ]);

            if ($entry === null) {
                return Entitlements::unknownPerson(Freshness::Unknown);
            }

            return Entitlements::fromArray($entry['data'], Freshness::Stale);
        }
    }

    /**
     * Drops the cached answer for a distinct id so the next check refetches.
     * Called from the webhook handler: a purchase that just landed should be
     * visible immediately, not up to a minute later.
     */
    public function invalidate(string $distinctId): void
    {
        $this->state->mutate(static function (array $state) use ($distinctId): array {
            unset($state[$distinctId]);

            return $state;
        });
    }

    /** @return array{storedAt: int, data: array<string, mixed>}|null */
    private function entry(string $distinctId): ?array
    {
        $entry = $this->state->read()[$distinctId] ?? null;

        if (!is_array($entry) || !is_int($entry['storedAt'] ?? null) || !is_array($entry['data'] ?? null)) {
            return null;
        }

        return ['storedAt' => $entry['storedAt'], 'data' => $entry['data']];
    }

    private function store(string $distinctId, Entitlements $entitlements, int $now): void
    {
        $this->state->mutate(static function (array $state) use ($distinctId, $entitlements, $now): array {
            $state[$distinctId] = ['storedAt' => $now, 'data' => $entitlements->toArray()];

            return array_filter(
                $state,
                static fn (mixed $entry): bool => is_array($entry)
                    && is_int($entry['storedAt'] ?? null)
                    && $now - $entry['storedAt'] < self::MAX_AGE_SECONDS,
            );
        });
    }
}
