<?php

namespace Voidhash\Exception;

use Psr\Http\Message\ResponseInterface;

/**
 * Unified exception for every failed API call.
 *
 * An error response carries the API's error envelope: {@see getType()} is its
 * broad kind (`not_found`, `conflict`, ...) and {@see getErrorCode()} the
 * specific, stable reason (`person_not_found`), which are the ways to branch
 * on a failure; the message is written for a person. {@see getParam()} names
 * the field at fault, and {@see getRequestId()} identifies the request when
 * you ask Voidhash about it.
 *
 * A failure that never reached the API, such as a misconfigured client, has
 * status 0 and an empty type.
 */
class ApiException extends \RuntimeException
{
    public function __construct(
        private readonly int $status,
        private readonly string $type,
        private readonly string $errorCode,
        string $message,
        private readonly ?string $param = null,
        private readonly ?string $requestId = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $status, $previous);
    }

    /**
     * Reads a failed response's error envelope,
     * `{ "error": { "type", "code", "message", "param" } }`. A body without
     * one keeps the status alone.
     */
    public static function fromResponse(ResponseInterface $response): self
    {
        $status = $response->getStatusCode();
        $body = json_decode((string) $response->getBody(), true);
        $body = is_array($body) ? $body : [];
        // Event ingest answers `{ "code", "error": "<message>" }` instead.
        $error = is_array($body['error'] ?? null)
            ? $body['error']
            : ['code' => $body['code'] ?? null, 'message' => $body['error'] ?? null];
        $text = static fn (mixed $value): ?string => is_string($value) && $value !== '' ? $value : null;

        return new self(
            $status,
            $text($error['type'] ?? null) ?? '',
            $text($error['code'] ?? null) ?? '',
            $text($error['message'] ?? null) ?? sprintf('voidhash: unexpected HTTP %d', $status),
            $text($error['param'] ?? null),
            $text($response->getHeaderLine('Request-Id')),
        );
    }

    /** A client that cannot make the call as configured; the message says what to change. */
    public static function configuration(string $message): self
    {
        return new self(0, '', 'configuration_error', $message);
    }

    /** A success response without the body its operation promises. */
    public static function unexpectedResponse(): self
    {
        return new self(0, '', 'unexpected_response', 'voidhash: the API answered without the expected response body');
    }

    /** The HTTP status of the failed response, or 0 when the call never got one. */
    public function getStatus(): int
    {
        return $this->status;
    }

    /**
     * The error's kind: `invalid_request`, `unauthenticated`,
     * `permission_denied`, `not_found`, `conflict`, `rate_limited`,
     * `unavailable` or `internal`; empty when the failure did not come from
     * an API error envelope.
     */
    public function getType(): string
    {
        return $this->type;
    }

    /**
     * The stable, specific reason, such as `person_not_found`, or
     * `configuration_error` for a misconfigured client. Named so because
     * {@see \Exception::getCode()} is the HTTP status.
     */
    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    /** The request field the error is about, when there is one. */
    public function getParam(): ?string
    {
        return $this->param;
    }

    /** The `Request-Id` header of the failed response. */
    public function getRequestId(): ?string
    {
        return $this->requestId;
    }
}
