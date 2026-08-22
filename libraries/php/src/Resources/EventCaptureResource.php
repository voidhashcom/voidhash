<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\EventCapture\Client;
use Voidhash\Generated\EventCapture\Exception\ClientException;
use Voidhash\Generated\EventCapture\Model\IV1CapturePostBody;

final class EventCaptureResource
{
    public function __construct(private readonly Client $client)
    {
    }

    /**
     * Posts one analytics event to the ingestion API.
     *
     * @param array{event: string, distinctId: string, properties?: array<string, mixed>} $event
     */
    public function capture(array $event): void
    {
        $body = new IV1CapturePostBody();
        $body->setEvent($event['event']);
        $body->setDistinctId($event['distinctId']);
        if (array_key_exists('properties', $event)) {
            $body->setProperties($event['properties'] ?? null);
        }

        try {
            $this->client->eventCaptureCapture($body);
        } catch (ClientException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
