<?php

declare(strict_types=1);

namespace Voidhash\Provider;

use Psr\Http\Message\ResponseInterface;
use Voidhash\Internal\ProviderProtocol;
use Voidhash\PaymentSources\Environment;

/**
 * Sends a correctly signed request through a {@see ProviderHandler}, for
 * testing a provider without a running server:
 *
 *     $response = ProviderTester::call($handler, 'catalog.list', ['cursor' => null]);
 *     $body = json_decode((string) $response->getBody(), true);
 */
final class ProviderTester
{
    /**
     * @param string $operation the protocol operation, such as `catalog.list`
     * @param array<string, mixed> $input the operation's input; dates may be given as \DateTimeInterface
     */
    public static function call(
        ProviderHandler $handler,
        string $operation,
        array $input = [],
        Environment $environment = Environment::Production,
    ): ResponseInterface {
        $input = array_map(
            static fn (mixed $value): mixed => $value instanceof \DateTimeInterface
                ? ProviderProtocol::formatDate(\DateTimeImmutable::createFromInterface($value))
                : $value,
            $input,
        );
        $payload = json_encode([
            'protocolVersion' => ProviderProtocol::VERSION,
            'id' => 'preq_test_' . bin2hex(random_bytes(8)),
            'source' => $handler->source,
            'environment' => $environment->value,
            'operation' => $operation,
            'input' => $input === [] ? new \stdClass() : $input,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $timestamp = (string) time();

        return $handler->handlePayload($payload, [
            ProviderHandler::TIMESTAMP_HEADER => $timestamp,
            ProviderHandler::SIGNATURE_HEADER => $handler->sign($timestamp, $payload),
        ]);
    }
}
