<?php

declare(strict_types=1);

namespace Voidhash\Provider;

use Voidhash\PaymentSources\Environment;

/** Asks for the current state of the subscription with the provider's id `id`. */
final readonly class SubscriptionRequest
{
    public function __construct(
        public string $id,
        public Environment $environment = Environment::Production,
    ) {
    }
}
