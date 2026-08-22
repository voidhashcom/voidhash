<?php

declare(strict_types=1);

namespace Voidhash\Example;

/**
 * A JSON response. Every route in this service answers with one.
 */
final class Response
{
    /**
     * @param array<string, mixed> $body
     */
    private function __construct(
        public readonly int $status,
        public readonly array $body,
    ) {
    }

    /**
     * @param array<string, mixed> $body
     */
    public static function json(int $status, array $body): self
    {
        return new self($status, $body);
    }

    /**
     * An error body in the shape every example in this suite uses:
     * a machine-readable `error` plus a human-readable `message`.
     *
     * @param array<string, mixed> $extra additional fields merged into the body
     */
    public static function error(int $status, string $error, string $message, array $extra = []): self
    {
        return new self($status, ['error' => $error, 'message' => $message, ...$extra]);
    }

    /** Writes the status line, headers and body to the SAPI. */
    public function send(): void
    {
        http_response_code($this->status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($this->body, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n";
    }

    /**
     * Ends the HTTP exchange while the process keeps working.
     *
     * Under php-fpm `fastcgi_finish_request()` flushes the response and hands
     * the connection back to the web server, so a webhook can be acknowledged
     * in milliseconds and processed afterwards. The CLI server has no such
     * call and will keep the socket open until this script returns, which is
     * one more reason not to run `php -S` in production.
     */
    public static function finishRequest(): void
    {
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();

            return;
        }

        if (ob_get_level() > 0) {
            ob_end_flush();
        }
        flush();
    }
}
