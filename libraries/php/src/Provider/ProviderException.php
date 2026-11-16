<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/**
 * Throw from a provider operation to answer with a chosen code and message,
 * returned to Voidhash as they are. Any other exception is answered as
 * `provider_error`, with its message shown only for test requests.
 */
final class ProviderException extends \RuntimeException
{
    public function __construct(
        public readonly ProviderErrorCode $errorCode,
        string $message,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}
