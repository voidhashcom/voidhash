<?php

declare(strict_types=1);

/**
 * Plays a purchase at FakePay: opens a checkout for the buyer's distinct id,
 * as your server would, and pays it. Then delivers FakePay's webhooks to the
 * local server, which reports the purchase to Voidhash: a charge for the
 * first period and, for the monthly product, the subscription it starts.
 *
 * Usage: php scripts/fakepay-purchase.php [product-key] [distinct-id]
 */

use Voidhash\Example\Billing\FakePay;
use Voidhash\Example\Config;
use Voidhash\Example\Nimbus\StateFile;

require dirname(__DIR__) . '/vendor/autoload.php';

Config::loadDotEnv(dirname(__DIR__) . '/.env');
$config = Config::fromEnvironment();

$url = $_ENV['NIMBUS_URL'] ?? getenv('NIMBUS_URL') ?: 'http://localhost:8080';
$productKey = $argv[1] ?? 'fakepay_pro_monthly';
$distinctId = $argv[2] ?? 'user-123';

$fakePay = new FakePay(StateFile::in($config->stateDir, 'fakepay.json'));
$checkout = $fakePay->createCheckout($productKey, $distinctId, 'https://nimbus.example/thanks');
$purchase = $fakePay->completeCheckout($checkout['id']);

$events = [['type' => 'transaction.completed', 'id' => $purchase['transactionId']]];
if ($purchase['subscriptionId'] !== null) {
    $events[] = ['type' => 'subscription.updated', 'id' => $purchase['subscriptionId']];
}

foreach ($events as $event) {
    $response = @file_get_contents($url . '/billing/webhook', false, stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => json_encode($event, JSON_THROW_ON_ERROR),
            'ignore_errors' => true,
        ],
    ]));

    echo $event['type'], ' ', $event['id'], "\n", $http_response_header[0] ?? 'no response', "\n", $response === false ? '' : $response, "\n";
}
