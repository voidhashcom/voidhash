<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\EventCapture\Client;
use Voidhash\Generated\EventCapture\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\EventCapture\Model\IV1CapturePostBody;

/**
 * Analytics ingestion.
 *
 * Unlike every other resource this does not authenticate with the secret key:
 * ingest is the same endpoint the mobile SDKs post to, and it authenticates on
 * the project's **publishable** key carried in the request body. Pass it as
 * `publishableKey` to {@see \Voidhash\VoidhashClient::create()}.
 */
final class EventCaptureResource
{
    public function __construct(
        private readonly Client $client,
        private readonly ?string $publishableKey,
    ) {
    }

    /** Whether a publishable key is configured; without one capture cannot be sent. */
    public function isEnabled(): bool
    {
        return $this->publishableKey !== null;
    }

    /**
     * Posts one analytics event to the ingestion API.
     *
     * `properties` are the event's own attributes; facts about the person
     * belong in {@see PersonsResource::setAttributes()} instead.
     *
     * @param array{
     *   event: string,
     *   distinctId: string,
     *   properties?: array<string, mixed>,
     *   context?: array<string, mixed>,
     *   timestamp?: \DateTimeInterface
     * } $event
     *
     * @return array{accepted: int, rejected: int} how many events ingest took and discarded
     *
     * @throws ApiException when no publishable key is configured, or ingest rejected the event
     */
    public function capture(array $event): array
    {
        if ($this->publishableKey === null) {
            throw new ApiException(0, 'ConfigurationError');
        }

        $body = new IV1CapturePostBody();
        $body->setUuid(self::uuidV4());
        $body->setEvent($event['event']);
        $body->setDistinctId($event['distinctId']);
        // Both are required JSON objects; CaptureBodyNormalizer keeps them that
        // way when they are empty.
        $body->setContext($event['context'] ?? []);
        $body->setProperties($event['properties'] ?? []);
        if (isset($event['timestamp'])) {
            $body->setTimestamp(\DateTime::createFromInterface($event['timestamp']));
        }
        $body->setSentAt(new \DateTime('now', new \DateTimeZone('UTC')));
        $body->setToken($this->publishableKey);

        try {
            $accepted = $this->client->eventCaptureCapture($body);
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }

        return [
            'accepted' => $accepted?->getAccepted() ?? 0,
            'rejected' => $accepted?->getRejected() ?? 0,
        ];
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
