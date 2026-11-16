<?php

declare(strict_types=1);

namespace Voidhash\Example\Exception;

/**
 * Voidhash could not answer: a transport failure, a timeout, or a 5xx.
 *
 * This is deliberately a different type from a 4xx answer. A 404 is Voidhash
 * telling you something true ("no such person"); this is Voidhash telling you
 * nothing at all, and code that treats the two the same revokes paying
 * customers during an outage.
 */
final class VoidhashUnavailableException extends \RuntimeException
{
}
