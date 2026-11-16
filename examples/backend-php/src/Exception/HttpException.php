<?php

declare(strict_types=1);

namespace Voidhash\Example\Exception;

/**
 * A deliberate, client-visible failure. `$errorCode` is the machine-readable
 * string that ends up in the `error` field of the JSON body — the values the
 * examples README pins down, such as `note_limit_reached`.
 */
final class HttpException extends \RuntimeException
{
    /**
     * @param array<string, mixed> $extra additional fields merged into the response body
     */
    public function __construct(
        private readonly int $status,
        private readonly string $errorCode,
        string $message,
        private readonly array $extra = [],
    ) {
        parent::__construct($message, $status);
    }

    /** @param array<string, mixed> $extra */
    public static function badRequest(string $errorCode, string $message, array $extra = []): self
    {
        return new self(400, $errorCode, $message, $extra);
    }

    /** @param array<string, mixed> $extra */
    public static function paymentRequired(string $errorCode, string $message, array $extra = []): self
    {
        return new self(402, $errorCode, $message, $extra);
    }

    /** @param array<string, mixed> $extra */
    public static function forbidden(string $errorCode, string $message, array $extra = []): self
    {
        return new self(403, $errorCode, $message, $extra);
    }

    /** @param array<string, mixed> $extra */
    public static function notFound(string $errorCode, string $message, array $extra = []): self
    {
        return new self(404, $errorCode, $message, $extra);
    }

    public static function methodNotAllowed(string $message): self
    {
        return new self(405, 'method_not_allowed', $message);
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    /** @return array<string, mixed> */
    public function getExtra(): array
    {
        return $this->extra;
    }
}
