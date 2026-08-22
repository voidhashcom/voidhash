<?php

namespace Voidhash\Internal;

use Nyholm\Psr7\Uri;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/**
 * PSR-18 decorator that resolves the generated endpoints' relative paths
 * against the configured base URL and attaches the default header set
 * (including the x-secret-key credential).
 *
 * @internal
 */
final class BaseUriHttpClient implements ClientInterface
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
        return $this->inner->sendRequest($request);
    }
}
