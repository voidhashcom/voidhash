<?php

declare(strict_types=1);

namespace Voidhash\Provider;

enum TransactionType: string
{
    case Charge = 'charge';
    case Refund = 'refund';
}
