<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/**
 * One page of history, at most 1000 items, all of the requested kind;
 * `nextCursor` is `null` on the last page.
 */
final readonly class HistoryPage
{
    /** @param list<Subscription>|list<Transaction> $items */
    public function __construct(
        public array $items,
        public ?string $nextCursor = null,
    ) {
    }
}
