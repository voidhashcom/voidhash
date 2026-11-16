<?php

declare(strict_types=1);

namespace Voidhash\PaymentSources;

/** Whether a payment is real money or a test. */
enum Environment: string
{
    case Production = 'production';
    case Test = 'test';
}
