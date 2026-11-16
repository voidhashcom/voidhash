<?php

declare(strict_types=1);

namespace Voidhash\Example\Controller;

use Voidhash\Example\Logger;
use Voidhash\Example\Nimbus\WebhookHandler;
use Voidhash\Example\Request;
use Voidhash\Example\Response;
use Voidhash\Exception\WebhookVerificationException;
use Voidhash\WebhookEvent;
use Voidhash\Webhooks;

final class WebhookController
{
    public function __construct(
        private readonly WebhookHandler $handler,
        private readonly Logger $logger,
        private readonly ?string $secret,
    ) {
    }

    /**
     * `POST /webhooks/voidhash` — verify, acknowledge, then handle.
     *
     * `$request->rawBody` is the untouched output of `php://input`. Voidhash
     * signs `{timestamp}.{rawBody}`, so any middleware that decodes and
     * re-encodes the body — `$_POST`, a JSON body parser, a framework's
     * `ParameterBag` — changes bytes somewhere (key order, unicode escapes,
     * whitespace) and every signature after that fails. Verify first, parse
     * second; {@see Webhooks::constructEvent()} does both in that order.
     *
     * A verification failure is a 400 and never a retry: Voidhash cannot
     * produce a better signature by sending the same request again.
     */
    public function __invoke(Request $request): Response
    {
        if ($this->secret === null) {
            $this->logger->error('webhook rejected: VOIDHASH_WEBHOOK_SECRET is not configured');

            return Response::error(503, 'webhook_not_configured', 'VOIDHASH_WEBHOOK_SECRET is not set on this server');
        }

        try {
            $event = Webhooks::constructEvent($request->rawBody, $request->headers, $this->secret);
        } catch (WebhookVerificationException $exception) {
            $this->logger->warning('webhook verification failed', [
                'reason' => $exception->reason,
                'detail' => $exception->getMessage(),
            ]);

            return Response::error(400, $exception->reason, 'webhook verification failed');
        }

        $this->acknowledgeThenHandle($event, $request->rawBody);

        return Response::json(200, ['received' => true, 'type' => $event->type]);
    }

    /**
     * Sends the 200 before doing the work.
     *
     * Voidhash retries deliveries it did not get a prompt 2xx for, so slow
     * handling manufactures the duplicate deliveries you then have to dedupe.
     * Under php-fpm the response is on the wire before the handler starts; the
     * CLI server has no equivalent, so locally the work simply happens first.
     */
    private function acknowledgeThenHandle(WebhookEvent $event, string $rawBody): void
    {
        register_shutdown_function(function () use ($event, $rawBody): void {
            try {
                $this->handler->handle($event, $rawBody);
            } catch (\Throwable $throwable) {
                $this->logger->error('webhook handling failed after acknowledgement', [
                    'type' => $event->type,
                    'cause' => $throwable->getMessage(),
                ]);
            }
        });
    }
}
