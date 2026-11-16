<?php

declare(strict_types=1);

/**
 * Signs a provider request the way Voidhash does and posts it at the local
 * server, so you can exercise `POST /voidhash/provider` without a tunnel.
 *
 * Usage: php scripts/call-provider.php <operation> ['<input as JSON>']
 *
 *     php scripts/call-provider.php describe
 *     php scripts/call-provider.php catalog.list '{"cursor":null}'
 *     php scripts/call-provider.php transaction.refund '{"transactionId":"fp_txn_…","amount":null,"reason":null}'
 */

use Voidhash\Example\Config;

require dirname(__DIR__) . '/vendor/autoload.php';

Config::loadDotEnv(dirname(__DIR__) . '/.env');
$config = Config::fromEnvironment();

if ($config->providerSecret === null) {
    fwrite(STDERR, "call-provider: VOIDHASH_PROVIDER_SECRET is not set\n");

    exit(1);
}

$url = $_ENV['NIMBUS_URL'] ?? getenv('NIMBUS_URL') ?: 'http://localhost:8080';
$operation = $argv[1] ?? 'describe';
$input = json_decode($argv[2] ?? '{}', false, 32, JSON_THROW_ON_ERROR);

$payload = json_encode([
    'protocolVersion' => 1,
    'id' => 'preq_local_' . bin2hex(random_bytes(6)),
    'source' => $config->paymentSource,
    'environment' => 'test',
    'operation' => $operation,
    'input' => $input,
], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
$timestamp = (string) time();
$signature = 'v1=' . hash_hmac('sha256', $timestamp . '.' . $payload, $config->providerSecret);

$response = @file_get_contents($url . '/voidhash/provider', false, stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => implode("\r\n", [
            'Content-Type: application/json',
            'X-Voidhash-Timestamp: ' . $timestamp,
            'X-Voidhash-Signature: ' . $signature,
        ]),
        'content' => $payload,
        'ignore_errors' => true,
    ],
]));

echo $http_response_header[0] ?? 'no response', "\n", $response === false ? '' : $response, "\n";
