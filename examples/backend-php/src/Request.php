<?php

declare(strict_types=1);

namespace Voidhash\Example;

use Voidhash\Example\Exception\HttpException;

/**
 * An inbound request, reduced to the five things this service cares about.
 */
final class Request
{
    /**
     * @param array<string, string> $query
     * @param array<string, string> $headers lower-cased header names
     */
    private function __construct(
        public readonly HttpMethod $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $headers,
        public readonly string $rawBody,
    ) {
    }

    /**
     * Builds a request from the SAPI globals.
     *
     * The body is read from `php://input`, not `$_POST`. `$_POST` is only
     * populated for form content types, it is already parsed, and a parsed body
     * cannot be re-serialised byte-for-byte — which would break the webhook
     * signature check in {@see \Voidhash\Example\Nimbus\WebhookHandler}. Read
     * the raw stream once, here, and hand the exact bytes around.
     */
    public static function fromGlobals(): self
    {
        $method = HttpMethod::tryFrom(strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')));
        if ($method === null) {
            throw HttpException::methodNotAllowed('this service speaks GET and POST only');
        }

        $target = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = parse_url($target, PHP_URL_PATH);

        parse_str((string) parse_url($target, PHP_URL_QUERY), $query);

        return new self(
            method: $method,
            path: rtrim(is_string($path) ? rawurldecode($path) : '/', '/') ?: '/',
            query: array_map(strval(...), array_filter($query, is_scalar(...))),
            headers: self::headersFromServer(),
            rawBody: (string) file_get_contents('php://input'),
        );
    }

    /** A trimmed query parameter, or null when absent or blank. */
    public function query(string $name): ?string
    {
        $value = trim($this->query[$name] ?? '');

        return $value === '' ? null : $value;
    }

    /**
     * The required `distinctId` query parameter.
     *
     * @throws HttpException 400 when the caller omitted it
     */
    public function requireDistinctId(): string
    {
        return $this->query('distinctId')
            ?? throw HttpException::badRequest('distinct_id_required', 'query parameter "distinctId" is required');
    }

    /**
     * The request body decoded as a JSON object.
     *
     * @return array<string, mixed>
     *
     * @throws HttpException 400 when the body is not a JSON object
     */
    public function json(): array
    {
        try {
            $decoded = json_decode($this->rawBody === '' ? 'null' : $this->rawBody, true, 32, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw HttpException::badRequest('invalid_json', 'request body is not valid JSON: ' . $exception->getMessage());
        }

        // `{}` decodes to `[]`, which array_is_list() calls a list. An empty
        // body is a valid object; the per-field checks below report what is
        // actually missing.
        if (!is_array($decoded) || ($decoded !== [] && array_is_list($decoded))) {
            throw HttpException::badRequest('invalid_json', 'request body must be a JSON object');
        }

        return $decoded;
    }

    /**
     * A required, non-empty string field of the JSON body.
     *
     * @param array<string, mixed> $body
     *
     * @throws HttpException 400 when the field is missing or not a string
     */
    public static function requireString(array $body, string $field): string
    {
        $value = $body[$field] ?? null;

        if (!is_string($value) || trim($value) === '') {
            $code = strtolower((string) preg_replace('/(?<!^)[A-Z]/', '_$0', $field)) . '_required';

            throw HttpException::badRequest($code, sprintf('body field "%s" must be a non-empty string', $field));
        }

        return trim($value);
    }

    /** @return array<string, string> */
    private static function headersFromServer(): array
    {
        $headers = [];

        foreach ($_SERVER as $name => $value) {
            if (!is_string($name) || !is_string($value) || !str_starts_with($name, 'HTTP_')) {
                continue;
            }
            $headers[strtolower(str_replace('_', '-', substr($name, 5)))] = $value;
        }

        return $headers;
    }
}
