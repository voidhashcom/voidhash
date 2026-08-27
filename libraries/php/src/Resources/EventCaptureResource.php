<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\EventCapture\Client;
use Voidhash\Generated\EventCapture\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\EventCapture\Model\CaptureAcceptedResponse;
use Voidhash\Generated\EventCapture\Model\IV1BatchPostBody;
use Voidhash\Generated\EventCapture\Model\IV1BatchPostBodyEventsItem;
use Voidhash\Generated\EventCapture\Model\IV1CapturePostBody;

/**
 * Analytics ingestion.
 *
 * Ingest is the same endpoint the mobile SDKs post to, but a server-side SDK
 * authenticates it the way every other resource does: with the project's
 * secret key in the `x-secret-key` header. The publishable key is optional and
 * only mirrors what a browser would send in the body `token`.
 *
 * @phpstan-type CaptureEventInput array{
 *   event: string,
 *   distinctId: string,
 *   uuid?: string,
 *   properties?: array<string, mixed>,
 *   context?: array<string, mixed>,
 *   sessionId?: string,
 *   timestamp: \DateTimeInterface
 * }
 */
final class EventCaptureResource
{
    public function __construct(
        private readonly Client $client,
        private readonly ?string $publishableKey,
    ) {
    }

    /**
     * Posts one analytics event to the ingestion API.
     *
     * `properties` are the event's own attributes; facts about the person
     * belong in {@see PersonsResource::setAttributes()} instead. A missing
     * `uuid` is generated here — reuse the same one when retrying an event so
     * the server deduplicates it.
     *
     * @param CaptureEventInput $event
     *
     * @return array{accepted: int, rejected: int} how many events ingest took and discarded
     *
     * @throws ApiException when ingest rejected the request
     */
    public function capture(array $event): array
    {
        $body = new IV1CapturePostBody();
        self::applyEvent($body, $event);
        $body->setSentAt(self::now());
        if ($this->publishableKey !== null) {
            $body->setToken($this->publishableKey);
        }

        return self::result(fn () => $this->client->eventCaptureCapture($body));
    }

    /**
     * Posts a batch of analytics events to the ingestion API. `sent_at` is
     * stamped once for the whole request.
     *
     * @param list<CaptureEventInput> $events
     *
     * @return array{accepted: int, rejected: int} how many events ingest took and discarded
     *
     * @throws ApiException when ingest rejected the request
     */
    public function batch(array $events): array
    {
        $items = [];
        foreach ($events as $event) {
            $item = new IV1BatchPostBodyEventsItem();
            self::applyEvent($item, $event);
            $items[] = $item;
        }

        $body = new IV1BatchPostBody();
        $body->setEvents($items);
        $body->setSentAt(self::now());
        if ($this->publishableKey !== null) {
            $body->setToken($this->publishableKey);
        }

        return self::result(fn () => $this->client->eventCaptureBatch($body));
    }

    /**
     * @param CaptureEventInput $event
     */
    private static function applyEvent(IV1CapturePostBody|IV1BatchPostBodyEventsItem $body, array $event): void
    {
        $uuid = $event['uuid'] ?? '';
        $body->setUuid($uuid !== '' ? $uuid : self::uuidV4());
        $body->setEvent($event['event']);
        $body->setDistinctId($event['distinctId']);
        // Both are required JSON objects; CaptureBodyNormalizer keeps them that
        // way when they are empty.
        $body->setContext($event['context'] ?? []);
        $body->setProperties($event['properties'] ?? []);

        $sessionId = $event['sessionId'] ?? '';
        if ($sessionId !== '') {
            $body->setSessionId($sessionId);
        }
        $timestamp = $event['timestamp'] ?? null;
        if (!$timestamp instanceof \DateTimeInterface) {
            throw new \InvalidArgumentException('voidhash: event timestamp is required');
        }
        $body->setTimestamp(self::isoDate($timestamp));
    }

    /**
     * @param callable(): (CaptureAcceptedResponse|\Psr\Http\Message\ResponseInterface|null) $send
     *
     * @return array{accepted: int, rejected: int}
     */
    private static function result(callable $send): array
    {
        try {
            $accepted = $send();
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }

        return [
            'accepted' => $accepted instanceof CaptureAcceptedResponse ? $accepted->getAccepted() : 0,
            'rejected' => $accepted instanceof CaptureAcceptedResponse ? $accepted->getRejected() : 0,
        ];
    }

    /**
     * Ingest types `sent_at` and `timestamp` as plain strings, so the ISO-8601
     * wire format is this SDK's job rather than the serializer's.
     */
    private static function now(): string
    {
        return self::isoDate(new \DateTimeImmutable('now', new \DateTimeZone('UTC')));
    }

    private static function isoDate(\DateTimeInterface $date): string
    {
        return $date->format(\DateTimeInterface::ATOM);
    }

    /** RFC 4122 version 4 UUID, which is all the ingest API asks of the client. */
    private static function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return implode('-', array_map(bin2hex(...), [
            substr($bytes, 0, 4),
            substr($bytes, 4, 2),
            substr($bytes, 6, 2),
            substr($bytes, 8, 2),
            substr($bytes, 10, 6),
        ]));
    }
}
