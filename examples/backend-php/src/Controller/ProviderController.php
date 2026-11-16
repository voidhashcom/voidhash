<?php

declare(strict_types=1);

namespace Voidhash\Example\Controller;

use Voidhash\Example\Request;
use Voidhash\Example\Response;
use Voidhash\Provider\ProviderHandler;

final class ProviderController
{
    /** @param ProviderHandler|null $handler null while VOIDHASH_PROVIDER_SECRET is not set */
    public function __construct(private readonly ?ProviderHandler $handler)
    {
    }

    /**
     * `POST /voidhash/provider` — the provider endpoint registered for the
     * payment source in Studio.
     *
     * Like the webhook route, the handler gets the raw body: it checks the
     * signature over the exact bytes Voidhash sent before reading them. Its
     * response is passed through untouched, status included, because Voidhash
     * reads the error codes in it.
     */
    public function __invoke(Request $request): Response
    {
        if ($this->handler === null) {
            return Response::error(503, 'provider_not_configured', 'VOIDHASH_PROVIDER_SECRET is not set on this server');
        }

        return Response::passthrough($this->handler->handlePayload($request->rawBody, $request->headers));
    }
}
