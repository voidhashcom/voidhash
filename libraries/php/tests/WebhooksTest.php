<?php

declare(strict_types=1);

namespace Voidhash\Tests;

use PHPUnit\Framework\TestCase;
use Voidhash\Exception\WebhookVerificationException;
use Voidhash\Webhooks;

final class WebhooksTest extends TestCase
{
    public function testConstructEventVerifiesAndParses(): void
    {
        $payload = '{"hello":"world"}';
        $timestamp = (string) time();
        $signature = 'v1=' . hash_hmac('sha256', $timestamp . '.' . $payload, 'whsec_test');

        $event = Webhooks::constructEvent($payload, [
            'X-Webhook-Event' => ['purchase.completed'],
            'X-Webhook-Timestamp' => [$timestamp],
            'X-Webhook-Signature' => [$signature],
        ], 'whsec_test');

        self::assertSame('purchase.completed', $event->type);
        self::assertSame(['hello' => 'world'], $event->payload);
        self::assertSame((int) $timestamp, $event->timestamp->getTimestamp());
    }

    public function testTamperedSignatureIsRejected(): void
    {
        $payload = '{"hello":"world"}';
        $timestamp = (string) time();
        $signature = substr('v1=' . hash_hmac('sha256', $timestamp . '.' . $payload, 'whsec_test'), 0, -4) . '0000';

        $this->expectException(WebhookVerificationException::class);
        Webhooks::constructEvent($payload, [
            'X-Webhook-Event' => ['purchase.completed'],
            'X-Webhook-Timestamp' => [$timestamp],
            'X-Webhook-Signature' => [$signature],
        ], 'whsec_test');
    }

    public function testStaleTimestampOutsideToleranceIsRejected(): void
    {
        $payload = '{}';
        $timestamp = (string) (time() - 3600);
        $signature = 'v1=' . hash_hmac('sha256', $timestamp . '.' . $payload, 'whsec_test');

        self::assertFalse(Webhooks::verifySignature($payload, $signature, $timestamp, 'whsec_test'));
    }

    public function testMissingHeaderThrows(): void
    {
        $this->expectException(WebhookVerificationException::class);
        Webhooks::constructEvent('{}', [], 'whsec_test');
    }
}
