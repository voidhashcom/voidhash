<?php

declare(strict_types=1);

namespace Voidhash;

use Voidhash\Exception\WebhookVerificationException;

/**
 * Verifies inbound webhook requests. Voidhash signs
 * `${timestamp}.${rawBody}` with HMAC-SHA256 keyed by the raw UTF-8 endpoint
 * secret and sends it as `v1=<lowercase hex>` in X-Webhook-Signature.
 *
 * The raw body must be the exact bytes Voidhash signed — parse JSON only
 * after calling {@see Webhooks::constructEvent()}.
 */
final class Webhooks
{
    public const EVENT_HEADER = 'x-webhook-event';
    public const SIGNATURE_HEADER = 'x-webhook-signature';
    public const TIMESTAMP_HEADER = 'x-webhook-timestamp';

    private const SIGNATURE_PREFIX = 'v1=';
    private const DEFAULT_TOLERANCE_SECONDS = 300;

    /**
     * Verifies an inbound webhook request and parses its body. Headers are
     * looked up case-insensitively; a repeated signing header is treated as
     * missing.
     *
     * @param string $payload raw request body, exactly as received
     * @param array<string, string|list<string>> $headers inbound headers
     * @param string $secret endpoint signing secret (whsec_...) from Studio
     * @param int $toleranceSeconds accepted clock skew in either direction
     * @param \DateTimeImmutable|null $now injectable for tests
     *
     * @throws WebhookVerificationException when the request cannot be trusted
     */
    public static function constructEvent(
        string $payload,
        array $headers,
        string $secret,
        int $toleranceSeconds = self::DEFAULT_TOLERANCE_SECONDS,
        ?\DateTimeImmutable $now = null,
    ): WebhookEvent {
        $eventName = self::readHeader($headers, self::EVENT_HEADER);
        $timestamp = self::readHeader($headers, self::TIMESTAMP_HEADER);
        $signature = self::readHeader($headers, self::SIGNATURE_HEADER);

        if (!self::verifySignature($payload, $signature, $timestamp, $secret, $toleranceSeconds, $now ?? new \DateTimeImmutable())) {
            throw new WebhookVerificationException('invalid_signature', 'signature or timestamp check failed');
        }

        try {
            /** @var array<string, mixed> $decoded */
            $decoded = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new WebhookVerificationException('invalid_payload', 'body is not valid JSON', $exception);
        }

        return new WebhookEvent(
            $eventName,
            $decoded,
            new \DateTimeImmutable('@' . $timestamp),
        );
    }

    /**
     * Checks a webhook signature and its timestamp freshness without parsing
     * the payload. Prefer {@see Webhooks::constructEvent()} unless you need
     * the boolean directly.
     */
    public static function verifySignature(
        string $payload,
        string $signature,
        string $timestamp,
        string $secret,
        int $toleranceSeconds = self::DEFAULT_TOLERANCE_SECONDS,
        ?\DateTimeImmutable $now = null,
    ): bool {
        if (preg_match('/^\d+$/', $timestamp) !== 1) {
            return false;
        }
        if (abs(($now ?? new \DateTimeImmutable())->getTimestamp() - (int) $timestamp) > $toleranceSeconds) {
            return false;
        }
        if (!str_starts_with($signature, self::SIGNATURE_PREFIX)) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
        $provided = substr($signature, strlen(self::SIGNATURE_PREFIX));

        return hash_equals($expected, $provided);
    }

    /**
     * The one value a header carries; repeats or absence throw — an ambiguous
     * signing header cannot be trusted.
     *
     * @param array<string, string|list<string>> $headers
     */
    private static function readHeader(array $headers, string $name): string
    {
        foreach ($headers as $headerName => $value) {
            if (strtolower((string) $headerName) !== $name) {
                continue;
            }
            if (is_array($value)) {
                if (count($value) !== 1) {
                    break;
                }
                $value = $value[0];
            }
            if (is_string($value) && $value !== '') {
                return $value;
            }
            break;
        }

        throw new WebhookVerificationException('missing_header', sprintf('webhook request must carry exactly one "%s" header', $name));
    }
}
