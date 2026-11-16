<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/** How a product is sold. */
enum ProductKind: string
{
    case Subscription = 'subscription';
    case OneTime = 'one_time';
    case Consumable = 'consumable';
}
