<?php

declare(strict_types=1);

namespace Voidhash\Example\Nimbus;

/**
 * Where an entitlement answer came from. Surfaced on every response so a
 * client — and you, reading the logs at 3am — can tell a confident "not Pro"
 * from a guess made during a Voidhash outage.
 */
enum Freshness: string
{
    /** Fetched from Voidhash while serving this request. */
    case Live = 'live';

    /** Served from the cache, still inside the TTL. */
    case Cached = 'cached';

    /** Voidhash is unreachable, so the last known answer was served past its TTL. */
    case Stale = 'stale';

    /** Voidhash is unreachable and nothing was cached. Assume nothing. */
    case Unknown = 'unknown';

    /** Whether the answer is a guess rather than something Voidhash confirmed. */
    public function isDegraded(): bool
    {
        return $this === self::Stale || $this === self::Unknown;
    }
}
