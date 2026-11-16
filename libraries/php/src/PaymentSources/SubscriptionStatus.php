<?php

declare(strict_types=1);

namespace Voidhash\PaymentSources;

/** The state a payment source reports for a subscription. */
enum SubscriptionStatus: string
{
    case Trialing = 'trialing';
    case Active = 'active';
    case PastDue = 'past_due';
    case Canceled = 'canceled';
    case Expired = 'expired';
}
