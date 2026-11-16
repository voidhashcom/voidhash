<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\EventCapture\Client;
use Voidhash\Generated\EventCapture\Model\CaptureAcceptedResponse;
use Voidhash\Generated\EventCapture\Model\CaptureEvent;
use Voidhash\Generated\EventCapture\Model\IV1BatchPostBody;
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
 *   groups?: array<string, string>,
 *   timestamp: \DateTimeInterface
 * }
 * @phpstan-type GroupIdentifyInput array{
 *   groupType: string,
 *   groupKey: string,
 *   properties?: array<string, string|int|float|bool>,
 *   setOnce?: array<string, string|int|float|bool>,
 *   timestamp?: \DateTimeInterface,
 *   uuid?: string
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

        return self::result($this->client->eventCaptureCapture($body));
    }

    /**
     * Sets a group's properties, such as a company's plan and seats, by sending
     * a `$groupidentify` event. It belongs to no person; events name the group
     * with `groups`, such as `['company' => 'acme']`. `properties` replace their
     * values, `setOnce` fill only properties the group has no value for, and a
     * later change of a property wins.
     *
     * @param GroupIdentifyInput $group
     *
     * @return array{accepted: int, rejected: int} how many events ingest took and discarded
     *
     * @throws ApiException when ingest rejected the request
     */
    public function groupIdentify(array $group): array
    {
        if ($group['groupType'] === '' || $group['groupKey'] === '') {
            throw new \InvalidArgumentException('voidhash: group type and key are required');
        }
        $named = '$group_' . $group['groupType'] . '_' . $group['groupKey'];
        // It belongs to no person, so the id only has to be valid: 255 characters at most.
        $distinctId = mb_strlen($named) <= 255 ? $named : '$group_' . $group['groupType'];
        // An empty map would encode as a JSON array, which ingest rejects, so it is left out.
        $properties = array_filter([
            '$group_set' => $group['properties'] ?? [],
            '$group_set_once' => $group['setOnce'] ?? [],
        ], static fn (array $values): bool => $values !== []);

        return $this->capture([
            'event' => '$groupidentify',
            'distinctId' => $distinctId,
            'properties' => [
                '$group_type' => $group['groupType'],
                '$group_key' => $group['groupKey'],
                ...$properties,
            ],
            'timestamp' => $group['timestamp'] ?? new \DateTimeImmutable('now', new \DateTimeZone('UTC')),
            ...(isset($group['uuid']) ? ['uuid' => $group['uuid']] : []),
        ]);
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
            $item = new CaptureEvent();
            self::applyEvent($item, $event);
            $items[] = $item;
        }

        $body = new IV1BatchPostBody();
        $body->setEvents($items);
        $body->setSentAt(self::now());
        if ($this->publishableKey !== null) {
            $body->setToken($this->publishableKey);
        }

        return self::result($this->client->eventCaptureBatch($body));
    }

    /**
     * @param CaptureEventInput $event
     */
    private static function applyEvent(IV1CapturePostBody|CaptureEvent $body, array $event): void
    {
        $uuid = $event['uuid'] ?? '';
        $body->setUuid($uuid !== '' ? $uuid : self::uuidV4());
        $body->setEvent($event['event']);
        $body->setDistinctId($event['distinctId']);
        // Both are required JSON objects; CaptureBodyNormalizer keeps them that
        // way when they are empty.
        $body->setContext($event['context'] ?? []);
        $body->setProperties(self::withGroups($event['properties'] ?? [], $event['groups'] ?? []));

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
     * The event's properties with `groups` as `$groups`; a group the
     * properties' own `$groups` names wins for its type.
     *
     * @param array<string, mixed>  $properties
     * @param array<string, string> $groups
     *
     * @return array<string, mixed>
     */
    private static function withGroups(array $properties, array $groups): array
    {
        if ($groups === []) {
            return $properties;
        }
        $own = $properties['$groups'] ?? [];
        $properties['$groups'] = is_array($own) ? [...$groups, ...$own] : $groups;

        return $properties;
    }

    /**
     * @return array{accepted: int, rejected: int}
     */
    private static function result(CaptureAcceptedResponse|\Psr\Http\Message\ResponseInterface|null $accepted): array
    {
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
