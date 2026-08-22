<?php

declare(strict_types=1);

namespace Voidhash\Exception;

/**
 * Thrown by {@see \Voidhash\Webhooks::constructEvent()} when a request cannot
 * be trusted. Respond with a 4xx: Voidhash never retries its way out of a bad
 * signature.
 */
final class WebhookVerificationException extends \RuntimeException
{
    /** @param string $reason "missing_header", "invalid_signature" or "invalid_payload" */
    public function __construct(
        public readonly string $reason,
        string $detail = '',
        ?\Throwable $previous = null,
    ) {
        parent::__construct(
            sprintf('voidhash: webhook verification failed (%s)%s', $reason, $detail !== '' ? ': ' . $detail : ''),
            0,
            $previous,
        );
    }
}
