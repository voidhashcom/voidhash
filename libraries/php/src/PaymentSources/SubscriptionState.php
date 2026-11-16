<?php

declare(strict_types=1);

namespace Voidhash\PaymentSources;

/**
 * The latest state of a subscription at a payment source. It carries no
 * money: report each payment as a {@see Charge}. `updatedAt` orders updates,
 * so an update older than the recorded one changes nothing.
 */
final readonly class SubscriptionState
{
    public function __construct(
        public string $productKey,
        public SubscriptionStatus $status,
        public \DateTimeImmutable $currentPeriodStart,
        public \DateTimeImmutable $currentPeriodEnd,
        public bool $isAutoRenewing,
        public \DateTimeImmutable $updatedAt,
        public ?string $distinctId = null,
        public ?string $customerId = null,
        public ?\DateTimeImmutable $canceledAt = null,
        public ?Environment $environment = null,
    ) {
    }
}
