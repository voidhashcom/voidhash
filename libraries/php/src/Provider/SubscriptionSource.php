<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/** A provider that looks up one subscription's current state. */
interface SubscriptionSource
{
    /**
     * Returns the subscription's current state, or `null` when the provider
     * does not know it. Voidhash asks when a period ended without a renewal
     * charge or a final state.
     *
     * @throws ProviderException to fail with a chosen code and message
     */
    public function getSubscription(SubscriptionRequest $request): ?Subscription;
}
