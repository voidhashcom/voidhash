<?php

namespace Voidhash\Exception;

/**
 * Unified exception for every non-2xx API response. The `tag` carries the
 * server-side error discriminant exactly as sent on the wire (for example
 * "Api/PersonNotFoundError"), which is the stable way to branch on specific
 * failures.
 */
class ApiException extends \RuntimeException
{
    public function __construct(
        private readonly int $status,
        private readonly string $tag = '',
        ?\Throwable $previous = null,
    ) {
        parent::__construct(
            $tag !== '' ? sprintf('voidhash: %d %s', $status, $tag) : sprintf('voidhash: unexpected HTTP %d', $status),
            $status,
            $previous,
        );
    }

    /**
     * Maps a generated client exception (which carries the status as code and
     * the wire `_tag` as message) onto this unified type.
     */
    public static function fromThrowable(\Throwable $throwable): self
    {
        return new self($throwable->getCode(), $throwable->getMessage(), $throwable);
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function getTag(): string
    {
        return $this->tag;
    }
}
