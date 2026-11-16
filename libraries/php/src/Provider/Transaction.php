<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/**
 * A charge or refund under the provider's id, in the shape the transactions
 * push endpoint takes. Amounts are integers in minor units.
 */
final readonly class Transaction
{
    public function __construct(
        public string $id,
        public TransactionType $type,
        public int $amount,
        public string $currency,
        public \DateTimeImmutable $occurredAt,
        public ?string $distinctId = null,
        public ?string $customerId = null,
        public ?string $productKey = null,
        public ?int $fee = null,
        public ?int $tax = null,
        public ?string $subscriptionId = null,
        public ?\DateTimeImmutable $periodStart = null,
        public ?\DateTimeImmutable $periodEnd = null,
        public ?string $refundsTransactionId = null,
    ) {
    }
}
