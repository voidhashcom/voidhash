<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/** A provider that cancels subscriptions when Voidhash asks it to. */
interface SubscriptionCancellation
{
    /**
     * Cancels the subscription at the provider, at the end of its period or
     * at once, and returns its state afterwards. Voidhash records that state
     * as if the provider had reported it, so reporting it again later
     * changes nothing.
     *
     * @throws ProviderException to fail with a chosen code and message
     */
    public function cancelSubscription(CancelSubscriptionRequest $request): Subscription;
}
