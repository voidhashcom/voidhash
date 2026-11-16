<?php

declare(strict_types=1);

namespace Voidhash\Provider;

use Voidhash\PaymentSources\Environment;

/**
 * Asks to refund the charge with the provider's id `transactionId`: `amount`
 * in minor units, or `null` for everything left of it, with an optional
 * `reason` of at most 500 characters.
 */
final readonly class RefundTransactionRequest
{
    public function __construct(
        public string $transactionId,
        public ?int $amount,
        public ?string $reason,
        public Environment $environment = Environment::Production,
    ) {
    }
}
