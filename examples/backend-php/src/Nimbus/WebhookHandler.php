<?php

declare(strict_types=1);

namespace Voidhash\Example\Nimbus;

use Voidhash\Example\Logger;
use Voidhash\WebhookEvent;

/**
 * What Nimbus does with a verified webhook delivery.
 *
 * Voidhash retries a delivery it did not get a fast 2xx for, so this runs at
 * least once and sometimes twice for the same event. Everything below is
 * either idempotent by nature (invalidating a cache key) or guarded by the
 * dedupe set.
 */
final class WebhookHandler
{
    /** Lifecycle events that can change what a person is entitled to. */
    private const ENTITLEMENT_EVENTS = [
        'subscription.created',
        'subscription.renewed',
        'subscription.cancelled',
        'subscription.expired',
        'purchase.completed',
        'purchase.refunded',
    ];

    private const DEDUPE_RETENTION_SECONDS = 86400;

    public function __construct(
        private readonly StateFile $seen,
        private readonly EntitlementCache $entitlements,
        private readonly Logger $logger,
    ) {
    }

    /**
     * Handles one verified delivery. Safe to call twice with the same body.
     *
     * @param string $rawBody the exact bytes Voidhash signed
     */
    public function handle(WebhookEvent $event, string $rawBody): void
    {
        $key = self::idempotencyKey($event->type, $rawBody);

        if (!$this->recordFirstSight($key)) {
            $this->logger->info('webhook redelivery ignored', ['type' => $event->type, 'key' => $key]);

            return;
        }

        $distinctId = is_string($event->payload['distinctId'] ?? null) ? $event->payload['distinctId'] : null;

        $this->logger->info('webhook received', [
            'type' => $event->type,
            'distinctId' => $distinctId,
            'signedAt' => $event->timestamp->format(\DateTimeInterface::ATOM),
        ]);

        if ($distinctId === null || !in_array($event->type, self::ENTITLEMENT_EVENTS, true)) {
            return;
        }

        // Drop the cached answer and let the next request refetch, rather than
        // patching entitlements from the payload. A `subscription.cancelled`
        // with `cancelAtPeriodEnd: true` still leaves the person Pro until the
        // period ends, and Voidhash already knows the rule — locally guessing
        // it is how a paying customer loses access a month early.
        $this->entitlements->invalidate($distinctId);
    }

    /**
     * The idempotency key for a delivery.
     *
     * Voidhash posts the bare payload with no delivery id, and a retry is
     * re-signed with a fresh timestamp, so the header set is not stable across
     * attempts. The body is: hashing it with the event name gives a key that is
     * identical for a retry and different for a genuinely new event.
     */
    public static function idempotencyKey(string $type, string $rawBody): string
    {
        return $type . ':' . hash('sha256', $rawBody);
    }

    /** True when this key has not been handled before. */
    private function recordFirstSight(string $key): bool
    {
        $isNew = false;
        $now = time();

        $this->seen->mutate(static function (array $state) use ($key, $now, &$isNew): array {
            $isNew = !isset($state[$key]);
            $state[$key] = $now;

            return array_filter(
                $state,
                static fn (mixed $seenAt): bool => is_int($seenAt) && $now - $seenAt < self::DEDUPE_RETENTION_SECONDS,
            );
        });

        return $isNew;
    }
}
