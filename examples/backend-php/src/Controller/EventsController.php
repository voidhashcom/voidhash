<?php

declare(strict_types=1);

namespace Voidhash\Example\Controller;

use Voidhash\Example\Exception\HttpException;
use Voidhash\Example\Nimbus\Analytics;
use Voidhash\Example\Request;
use Voidhash\Example\Response;

final class EventsController
{
    public function __construct(private readonly Analytics $analytics)
    {
    }

    /**
     * `POST /v1/events` — forwards a client-supplied analytics event.
     *
     * Routing analytics through your own backend, where you can attach or
     * reject properties before they leave the building, is the point of this
     * endpoint. Because the caller asked for exactly one thing, a capture
     * failure is reported instead of swallowed — unlike the events the product
     * emits on the side.
     */
    public function __invoke(Request $request): Response
    {
        $body = $request->json();
        $distinctId = Request::requireString($body, 'distinctId');
        $event = Request::requireString($body, 'event');
        $properties = $body['properties'] ?? [];

        if (!is_array($properties) || ($properties !== [] && array_is_list($properties))) {
            throw HttpException::badRequest('invalid_properties', 'body field "properties" must be a JSON object');
        }

        $this->analytics->captureOrFail($event, $distinctId, $properties);

        return Response::json(202, [
            'status' => 'accepted',
            'event' => $event,
            'distinctId' => $distinctId,
        ]);
    }
}
