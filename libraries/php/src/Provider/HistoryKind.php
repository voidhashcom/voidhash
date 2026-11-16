<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/** The records a history request pages through. */
enum HistoryKind: string
{
    case Subscriptions = 'subscriptions';
    case Transactions = 'transactions';
}
