<?php

declare(strict_types=1);

namespace Voidhash\Tests;

use Nyholm\Psr7\Factory\Psr17Factory;
use Nyholm\Psr7\Response;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/**
 * Minimal scriptable PSR-18 client: each queued response is returned in
 * order; requests are recorded for assertions.
 */
final class StubHttpClient implements ClientInterface
{
    /** @var list<RequestInterface> */
    public array $requests = [];

    /** @var list<Response|callable(RequestInterface): Response> */
    private array $responses = [];

    private readonly Psr17Factory $factory;

    public function __construct()
    {
        $this->factory = new Psr17Factory();
    }

    public function queue(Response|callable $response): void
    {
        $this->responses[] = $response;
    }

    /** Queues a JSON response. @param array<string, mixed>|list<mixed> $body */
    public function queueJson(int $status, array $body, string $contentType = 'application/json'): void
    {
        $this->queue(new Response($status, ['content-type' => $contentType], json_encode($body)));
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $this->requests[] = $request;
        if ($this->responses === []) {
            throw new \RuntimeException('StubHttpClient: no queued response');
        }
        $next = array_shift($this->responses);
        if ($next instanceof Response) {
            return $next;
        }

        return $next($request);
    }
}
