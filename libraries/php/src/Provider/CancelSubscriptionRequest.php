<?php

declare(strict_types=1);

namespace Voidhash\Provider;

use Voidhash\PaymentSources\Environment;

/**
 * Asks to cancel the subscription with the provider's id `id`: when
 * `atPeriodEnd` is true it stops renewing and keeps its access until the
 * period ends, otherwise it ends now.
 */
final readonly class CancelSubscriptionRequest
{
    public function __construct(
        public string $id,
        public bool $atPeriodEnd,
        public Environment $environment = Environment::Production,
    ) {
    }
}
