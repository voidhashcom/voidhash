<?php

declare(strict_types=1);

namespace Voidhash;

/**
 * A verified webhook delivery, returned by {@see Webhooks::constructEvent()}.
 */
final class WebhookEvent
{
    /**
     * @param string $type the X-Webhook-Event header value
     * @param array<string, mixed> $payload the parsed JSON body
     * @param \DateTimeImmutable $timestamp the signing time from X-Webhook-Timestamp
     */
    public function __construct(
        public readonly string $type,
        public readonly array $payload,
        public readonly \DateTimeImmutable $timestamp,
    ) {
    }
}
