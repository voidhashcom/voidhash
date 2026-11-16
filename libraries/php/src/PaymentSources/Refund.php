<?php

declare(strict_types=1);

namespace Voidhash\PaymentSources;

/**
 * Money a payment source returned for an earlier charge, named by
 * `refundsTransactionId`. A refund of everything left of the charge ends the
 * access it granted; a smaller one reverses only its share of revenue. Its
 * currency must be the charge's.
 */
final readonly class Refund
{
    public function __construct(
        public string $refundsTransactionId,
        public int $amount,
        public string $currency,
        public \DateTimeImmutable $occurredAt,
        public ?string $distinctId = null,
        public ?string $customerId = null,
        public ?string $productKey = null,
        public ?int $fee = null,
        public ?int $tax = null,
        public ?Environment $environment = null,
    ) {
    }
}
