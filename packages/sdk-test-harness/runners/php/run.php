<?php

/**
 * Generic conformance runner for the Voidhash SDK test harness. Like the
 * iOS and Android runners it is fully generic: step descriptors come from
 * the /__harness control plane and no fixture data is encoded locally, so
 * suites can evolve without touching this file.
 */

declare(strict_types=1);

const DEFAULT_HARNESS_URL = 'http://127.0.0.1:4919';

/** @return array{0: int, 1: string} status and body */
function harness_request(string $method, string $url, string $body = '', array $headers = []): array
{
    $headerLines = ['content-type: application/json'];
    foreach ($headers as $name => $value) {
        $headerLines[] = "{$name}: {$value}";
    }

    $context = stream_context_create(['http' => [
        'method' => $method,
        'header' => implode("\r\n", $headerLines),
        'content' => $method === 'GET' || $method === 'HEAD' ? '' : $body,
        'ignore_errors' => true,
        'protocol_version' => 1.1,
    ]]);

    $responseBody = @file_get_contents($url, false, $context);
    if ($responseBody === false) {
        throw new RuntimeException("request failed: {$method} {$url}");
    }

    foreach ($http_response_header ?? [] as $line) {
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $line, $matches) === 1) {
            return [(int) $matches[1], $responseBody];
        }
    }

    throw new RuntimeException("no status line for {$method} {$url}");
}

/** Structural JSON equality with a tiny float tolerance so number round-trips stay comparable. */
function json_matches(mixed $expected, mixed $actual): bool
{
    if (is_int($expected) || is_float($expected)) {
        return (is_int($actual) || is_float($actual))
            && abs((float) $expected - (float) $actual) <= 1e-9 * max(1.0, abs((float) $expected));
    }
    if (is_array($expected)) {
        if (!is_array($actual) || count($expected) !== count($actual)) {
            return false;
        }
        foreach ($expected as $key => $value) {
            if (!array_key_exists($key, $actual) || !json_matches($value, $actual[$key])) {
                return false;
            }
        }
        return true;
    }

    return $expected === $actual;
}

function fail(string $message): never
{
    fwrite(STDERR, "conformance: {$message}\n");
    exit(1);
}

$baseUrl = getenv('HARNESS_URL') ?: DEFAULT_HARNESS_URL;

[, $body] = harness_request('GET', "{$baseUrl}/__harness/suites");
$suites = json_decode($body, true, 512, JSON_THROW_ON_ERROR)['suites'] ?? [];

foreach ($suites as $suite) {
    $suiteName = $suite['name'];
    // The harness self-test suites exercise the verifier itself, not the
    // wire contract runners are responsible for.
    if (str_starts_with($suiteName, 'test/')) {
        continue;
    }

    [, $body] = harness_request(
        'POST',
        "{$baseUrl}/__harness/sessions",
        json_encode(['suite' => $suiteName], JSON_THROW_ON_ERROR),
    );
    $session = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    $sessionId = $session['sessionId'];

    foreach ($session['steps'] as $step) {
        $stepRequest = $step['request'];
        $headers = array_change_key_case($stepRequest['headers'] ?? [], CASE_LOWER);
        foreach ($stepRequest['requireHeaders'] ?? [] as $header) {
            $lower = strtolower($header);
            if (!array_key_exists($lower, $headers)) {
                $headers[$lower] = "conformance-{$header}";
            }
        }

        $requestBody = '';
        if (array_key_exists('body', $stepRequest) && $stepRequest['body'] !== null) {
            $headers['content-type'] = 'application/json';
            $requestBody = json_encode($stepRequest['body'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        } elseif (!in_array($stepRequest['method'], ['GET', 'HEAD'], true)) {
            $headers['content-type'] = 'application/json';
        }

        [$status, $responseBody] = harness_request(
            $stepRequest['method'],
            "{$baseUrl}{$stepRequest['path']}",
            $requestBody,
            $headers + ['x-harness-session' => $sessionId],
        );

        $expectedStatus = $step['responses'][0]['status'] ?? 200;
        if ($status !== $expectedStatus) {
            fail(sprintf("step %s (%s %s): expected status %d, got %d", $step['id'], $stepRequest['method'], $stepRequest['path'], $expectedStatus, $status));
        }

        $expectedBody = $step['responses'][0]['body'] ?? null;
        if ($expectedBody !== null) {
            $actual = json_decode($responseBody, true, 512, JSON_THROW_ON_ERROR);
            if (!json_matches($expectedBody, $actual)) {
                fail(sprintf(
                    "step %s: body mismatch\nexpected: %s\nactual: %s",
                    $step['id'],
                    json_encode($expectedBody),
                    $responseBody,
                ));
            }
        }
    }

    [, $body] = harness_request('POST', "{$baseUrl}/__harness/sessions/{$sessionId}/complete", '{}');
    $report = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    if (($report['pass'] ?? false) !== true) {
        fail("suite {$suiteName} failed:\n" . json_encode($report['violations'] ?? [], JSON_PRETTY_PRINT));
    }

    printf("suite %s passed (%d steps)\n", $suiteName, count($session['steps']));
}
