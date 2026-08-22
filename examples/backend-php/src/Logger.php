<?php

declare(strict_types=1);

namespace Voidhash\Example;

/**
 * Structured logging to stderr, which is where both `php -S` and php-fpm
 * expect a worker to talk. Anything you would want to see while debugging a
 * webhook or an outage goes through here.
 */
final class Logger
{
    /** @var resource */
    private $stream;

    /** @param resource|null $stream defaults to stderr */
    public function __construct($stream = null)
    {
        $this->stream = $stream ?? (defined('STDERR') ? STDERR : fopen('php://stderr', 'w'));
    }

    /** @param array<string, mixed> $context */
    public function info(string $message, array $context = []): void
    {
        $this->write('info', $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function warning(string $message, array $context = []): void
    {
        $this->write('warning', $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function error(string $message, array $context = []): void
    {
        $this->write('error', $message, $context);
    }

    /** @param array<string, mixed> $context */
    private function write(string $level, string $message, array $context): void
    {
        fwrite($this->stream, json_encode([
            'level' => $level,
            'time' => gmdate('Y-m-d\TH:i:s\Z'),
            'message' => $message,
            ...$context,
        ], JSON_UNESCAPED_SLASHES) . "\n");
    }
}
