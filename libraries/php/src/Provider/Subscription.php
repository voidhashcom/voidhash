<?php

declare(strict_types=1);

namespace Voidhash\Provider;

use Voidhash\PaymentSources\SubscriptionStatus;

/**
 * A subscription's state under the provider's id, in the shape the
 * subscriptions push endpoint takes. Name the buyer with `distinctId`,
 * `customerId` (the provider's customer id), or both.
 */
final readonly class Subscription
{
    public function __construct(
        public string $id,
        public string $productKey,
        public SubscriptionStatus $status,
        public \DateTimeImmutable $currentPeriodStart,
        public \DateTimeImmutable $currentPeriodEnd,
        public bool $willRenew,
        public \DateTimeImmutable $updatedAt,
        public ?string $distinctId = null,
        public ?string $customerId = null,
        public ?\DateTimeImmutable $canceledAt = null,
    ) {
    }
}
