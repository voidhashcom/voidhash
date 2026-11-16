<?php

namespace Voidhash\Internal;

use Nyholm\Psr7\Uri;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Voidhash\Exception\ApiException;

/**
 * The HTTP client the generated clients send through. It resolves their
 * relative paths against the base URL, attaches the default headers (the
 * credential among them), and turns every response that is not a success
 * into an {@see ApiException}.
 *
 * Failing here rather than in the generated endpoints is deliberate: they
 * recognise only the error statuses the spec lists for each operation and
 * return null for any other, which would read as an empty success. Unlike a
 * general PSR-18 client it therefore throws for 4xx and 5xx responses, so it
 * is never handed to callers.
 *
 * @internal
 */
final class ApiTransport implements ClientInterface
{
    /**
     * @param array<string, string> $headers
     */
    public function __construct(
        private readonly ClientInterface $inner,
        private readonly string $baseUri,
        private readonly array $headers,
    ) {
    }

    /**
     * @throws ApiException for a response that is not a 2xx
     */
    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $uri = $request->getUri();
        if ($uri->getHost() === '') {
            $base = new Uri($this->baseUri);
            $uri = $base
                ->withPath(rtrim($base->getPath(), '/') . '/' . ltrim($uri->getPath(), '/'))
                ->withQuery($uri->getQuery());
            $request = $request->withUri($uri);
        }

        foreach ($this->headers as $name => $value) {
            if (!$request->hasHeader($name)) {
                $request = $request->withHeader($name, $value);
            }
        }

        $response = $this->inner->sendRequest($request);
        if ($response->getStatusCode() >= 300) {
            throw ApiException::fromResponse($response);
        }

        return $response;
    }
}
