<?php

declare(strict_types=1);

namespace Voidhash\Example\Nimbus;

use Voidhash\Example\Logger;
use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Model\SetPersonAttributesBodyJsonEncoding;
use Voidhash\VoidhashClient;

/**
 * Server-side analytics, over the SDK.
 *
 * Two different credentials are in play, which is the thing worth noticing:
 *
 * - {@see Analytics::capture()} posts to event ingest, which authenticates on
 *   the **publishable** key (`publishableKey` in
 *   {@see VoidhashClient::create()}). It is a no-op when that is unset.
 * - {@see Analytics::setAttributes()} is a server-to-server write on the
 *   **secret** key. Traits describe the person and persist, so facts like the
 *   current plan go here rather than being repeated on every event.
 */
final class Analytics
{
    public const NOTE_CREATED = 'note_created';
    public const EXPORT_REQUESTED = 'export_requested';
    public const PAYWALL_VIEWED = 'paywall_viewed';
    public const CHECKOUT_STARTED = 'checkout_started';

    public function __construct(
        private readonly VoidhashClient $client,
        private readonly Logger $logger,
    ) {
    }

    /** Whether a publishable key is configured; when false every capture is a no-op. */
    public function isEnabled(): bool
    {
        return $this->client->eventCapture->isEnabled();
    }

    /**
     * Captures an event, logging and swallowing any failure.
     *
     * Use this for events the product emits as a side effect. Nobody should
     * lose a note because the analytics pipeline had a bad minute.
     *
     * @param array<string, mixed> $properties
     */
    public function capture(string $event, string $distinctId, array $properties = []): void
    {
        try {
            $this->captureOrFail($event, $distinctId, $properties);
        } catch (ApiException $exception) {
            $this->logger->warning('event capture failed', [
                'event' => $event,
                'distinctId' => $distinctId,
                'cause' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * Captures an event and lets failures propagate. Returns false when
     * analytics is not configured, which is not a failure.
     *
     * Use this when forwarding an event is the whole point of the request, as
     * on `POST /v1/events`: the caller asked for one thing, so tell them the
     * truth about whether it happened.
     *
     * @param array<string, mixed> $properties
     *
     * @throws ApiException when ingest rejected the event
     */
    public function captureOrFail(string $event, string $distinctId, array $properties = []): bool
    {
        if (!$this->isEnabled()) {
            return false;
        }

        $this->client->eventCapture->capture([
            'event' => $event,
            'distinctId' => $distinctId,
            'properties' => $properties,
        ]);

        return true;
    }

    /**
     * Writes person traits, logging and swallowing any failure. Unlike capture
     * this uses the secret key, so it works even when analytics is switched off.
     *
     * @param array<string, string|int|float|bool|null> $traits
     */
    public function setAttributes(string $distinctId, array $traits): void
    {
        try {
            $this->client->persons->setAttributes(
                (new SetPersonAttributesBodyJsonEncoding())
                    ->setDistinctId($distinctId)
                    ->setTraits($traits),
            );
        } catch (ApiException $exception) {
            $this->logger->warning('writing person attributes failed', [
                'distinctId' => $distinctId,
                'cause' => $exception->getMessage(),
            ]);
        }
    }
}
