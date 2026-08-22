<?php

declare(strict_types=1);

namespace Voidhash\Example;

use Voidhash\Example\Exception\ConfigurationException;
use Voidhash\VoidhashClient;

/**
 * Everything the service reads from the environment, validated once at boot.
 */
final class Config
{
    private function __construct(
        public readonly string $secretKey,
        public readonly ?string $webhookSecret,
        public readonly ?string $publishableKey,
        public readonly string $baseUrl,
        public readonly string $ingestUrl,
        public readonly int $port,
        public readonly string $stateDir,
    ) {
    }

    /**
     * Reads and validates the environment.
     *
     * @throws ConfigurationException when a required variable is missing or malformed
     */
    public static function fromEnvironment(): self
    {
        $secretKey = self::read('VOIDHASH_SECRET_KEY');
        if ($secretKey === null) {
            throw new ConfigurationException(
                'VOIDHASH_SECRET_KEY is not set. Copy .env.example to .env, put your vh_sk_… key in it, and restart.',
            );
        }
        if (!str_starts_with($secretKey, 'vh_sk_')) {
            throw new ConfigurationException(
                'VOIDHASH_SECRET_KEY does not look like a secret key (expected a vh_sk_… value from Project settings → API keys).',
            );
        }

        $port = self::read('PORT') ?? '8080';
        if (preg_match('/^\d+$/', $port) !== 1) {
            throw new ConfigurationException(sprintf('PORT must be a number, got "%s".', $port));
        }

        return new self(
            secretKey: $secretKey,
            webhookSecret: self::read('VOIDHASH_WEBHOOK_SECRET'),
            publishableKey: self::read('VOIDHASH_PUBLISHABLE_KEY'),
            baseUrl: rtrim(self::read('VOIDHASH_BASE_URL') ?? VoidhashClient::DEFAULT_BASE_URL, '/'),
            ingestUrl: rtrim(self::read('VOIDHASH_INGEST_URL') ?? VoidhashClient::DEFAULT_INGEST_URL, '/'),
            port: (int) $port,
            stateDir: self::read('NIMBUS_STATE_DIR') ?? sys_get_temp_dir() . '/nimbus-backend-php',
        );
    }

    /**
     * Loads a dotenv-style file into the environment without overwriting
     * variables that are already set. Only `KEY=value` lines and `#` comments
     * are understood — enough for the shipped `.env.example`, and small enough
     * that you can read it before trusting it with your secret key.
     */
    public static function loadDotEnv(string $path): void
    {
        if (!is_readable($path)) {
            return;
        }

        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }

            [$name, $value] = explode('=', $line, 2);
            $name = trim($name);
            $value = trim(trim($value), "\"'");

            if ($name !== '' && self::read($name) === null) {
                putenv($name . '=' . $value);
                $_ENV[$name] = $value;
            }
        }
    }

    private static function read(string $name): ?string
    {
        $value = $_ENV[$name] ?? getenv($name);

        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        return trim($value);
    }
}
