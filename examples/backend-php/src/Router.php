<?php

declare(strict_types=1);

namespace Voidhash\Example;

use Voidhash\Example\Exception\HttpException;

/**
 * Exact-path routing. The Nimbus API has no path parameters, so there is
 * nothing here to regex — resist adding it until a route needs it.
 */
final class Router
{
    /** @var array<string, array<string, callable(Request): Response>> path => method => handler */
    private array $routes = [];

    /**
     * Registers a handler. Registering the same method and path twice is a
     * programming error and overwrites the first handler.
     *
     * @param callable(Request): Response $handler
     */
    public function add(HttpMethod $method, string $path, callable $handler): void
    {
        $this->routes[$path][$method->value] = $handler;
    }

    /**
     * @throws HttpException 404 for an unknown path, 405 for a known path with the wrong method
     */
    public function dispatch(Request $request): Response
    {
        $handlers = $this->routes[$request->path] ?? null;

        if ($handlers === null) {
            throw HttpException::notFound('not_found', sprintf('no route for %s %s', $request->method->value, $request->path));
        }

        $handler = $handlers[$request->method->value]
            ?? throw HttpException::methodNotAllowed(sprintf(
                '%s accepts %s',
                $request->path,
                implode(', ', array_keys($handlers)),
            ));

        return $handler($request);
    }
}
