<?php

declare(strict_types=1);

use Voidhash\Example\Application;
use Voidhash\Example\Config;
use Voidhash\Example\Exception\ConfigurationException;

require dirname(__DIR__) . '/vendor/autoload.php';

Config::loadDotEnv(dirname(__DIR__) . '/.env');

try {
    $config = Config::fromEnvironment();
} catch (ConfigurationException $exception) {
    // Fail loudly and identically on every request: a service that boots
    // without its credentials only tells you so at the worst possible moment.
    fwrite(STDERR, 'nimbus: ' . $exception->getMessage() . "\n");
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'configuration_error', 'message' => $exception->getMessage()]), "\n";

    exit(1);
}

Application::create($config)->run();
