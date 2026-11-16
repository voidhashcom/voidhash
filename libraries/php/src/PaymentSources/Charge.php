<?php

declare(strict_types=1);

namespace Voidhash\PaymentSources;

/**
 * A payment collected by a payment source. Name the buyer with `distinctId`,
 * `customerId` (the source's own customer id), or both. A charge for a
 * subscription period carries `subscriptionId`, `periodStart` and `periodEnd`;
 * without them it completes a one-time purchase.
 *
 * Amounts are integers in minor units (4900 is 49.00 EUR); `fee` is the
 * source's commission.
 */
final readonly class Charge
{
    public function __construct(
        public string $productKey,
        public int $amount,
        public string $currency,
        public \DateTimeImmutable $occurredAt,
        public ?string $distinctId = null,
        public ?string $customerId = null,
        public ?int $fee = null,
        public ?int $tax = null,
        public ?string $subscriptionId = null,
        public ?\DateTimeImmutable $periodStart = null,
        public ?\DateTimeImmutable $periodEnd = null,
        public ?Environment $environment = null,
    ) {
    }
}
