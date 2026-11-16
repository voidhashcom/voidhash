<?php

declare(strict_types=1);

namespace Voidhash\Provider;

use Voidhash\PaymentSources\Environment;

/** Asks for a page of records of one kind created before `before`; `cursor` is `null` for the first page. */
final readonly class HistoryRequest
{
    public function __construct(
        public HistoryKind $kind,
        public ?string $cursor,
        public \DateTimeImmutable $before,
        public Environment $environment = Environment::Production,
    ) {
    }
}
