<?php

declare(strict_types=1);

/**
 * Signs a webhook payload the way Voidhash does and posts it at the local
 * server, so you can exercise `POST /webhooks/voidhash` without a tunnel.
 *
 * Usage: php scripts/send-webhook.php [event-type] [distinct-id]
 */

use Voidhash\Example\Config;

require dirname(__DIR__) . '/vendor/autoload.php';

Config::loadDotEnv(dirname(__DIR__) . '/.env');

$secret = $_ENV['VOIDHASH_WEBHOOK_SECRET'] ?? getenv('VOIDHASH_WEBHOOK_SECRET');
if (!is_string($secret) || $secret === '') {
    fwrite(STDERR, "send-webhook: VOIDHASH_WEBHOOK_SECRET is not set\n");

    exit(1);
}

$url = $_ENV['NIMBUS_URL'] ?? getenv('NIMBUS_URL') ?: 'http://localhost:8080';
$type = $argv[1] ?? 'subscription.created';
$distinctId = $argv[2] ?? 'user-123';
$now = gmdate('Y-m-d\TH:i:s\Z');

// The bare lifecycle payload, as documented in the webhook reference: there is
// no envelope, and the event name is repeated in the X-Webhook-Event header.
$payload = json_encode([
    'type' => $type,
    'distinctId' => $distinctId,
    'personId' => 'person_example',
    'projectId' => 'project_example',
    'environment' => 'production',
    'occurredAt' => $now,
    'productId' => 'product_example',
    'productSlug' => 'pro-monthly',
    'provider' => 'app_store',
    'providerProductId' => 'com.nimbus.pro.monthly',
    'subscriptionId' => 'sub_example',
    'providerSubscriptionId' => 'app_store_sub_example',
    'providerTransactionId' => null,
    'status' => 'active',
    'isTrial' => false,
    'amount' => ['currency' => 'USD', 'grossAmount' => 999],
    'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', time() + 2592000),
    'purchasedAt' => $now,
    'startsAt' => $now,
], JSON_THROW_ON_ERROR);

$timestamp = (string) time();
$signature = 'v1=' . hash_hmac('sha256', $timestamp . '.' . $payload, $secret);

$response = @file_get_contents($url . '/webhooks/voidhash', false, stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => implode("\r\n", [
            'Content-Type: application/json',
            'X-Webhook-Event: ' . $type,
            'X-Webhook-Timestamp: ' . $timestamp,
            'X-Webhook-Signature: ' . $signature,
        ]),
        'content' => $payload,
        'ignore_errors' => true,
    ],
]));

echo implode("\n", $http_response_header ?? ['no response']), "\n\n", $response === false ? '' : $response, "\n";
