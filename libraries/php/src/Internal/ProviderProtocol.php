<?php

declare(strict_types=1);

namespace Voidhash\Internal;

use Voidhash\PaymentSources\SubscriptionStatus;
use Voidhash\Provider\HistoryKind;
use Voidhash\Provider\ProductKind;
use Voidhash\Provider\ProviderErrorCode;
use Voidhash\Provider\ProviderException;
use Voidhash\Provider\TransactionType;

/**
 * The payment source provider protocol's rules for operation inputs and
 * results, in wire form.
 *
 * @internal
 */
final class ProviderProtocol
{
    public const VERSION = 1;

    private const IDENTIFIER_MAX_LENGTH = 255;
    private const RECORD_ID_MAX_LENGTH = 200;
    private const PAGE_MAX_ITEMS = 1000;
    private const REFUND_REASON_MAX_LENGTH = 500;

    /** Formats an instant the way the protocol carries dates: ISO 8601 in UTC with milliseconds. */
    public static function formatDate(\DateTimeImmutable $date): string
    {
        return $date->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }

    /**
     * Reads an operation's input: cursors stay strings or null, `kind`
     * becomes a {@see HistoryKind} and `before` a date; every other field
     * keeps its wire value.
     *
     * @return array<string, mixed>
     *
     * @throws ProviderException with code invalid_request when the input breaks the protocol
     */
    public static function parseInput(string $operation, mixed $input): array
    {
        if (!self::isObject($input)) {
            throw self::invalidInput('input must be an object');
        }

        return match ($operation) {
            'catalog.list' => ['cursor' => self::cursorInput($input)],
            'history.list' => [
                'kind' => HistoryKind::tryFrom(is_string($input['kind'] ?? null) ? $input['kind'] : '')
                    ?? throw self::invalidInput('input.kind must be subscriptions or transactions'),
                'cursor' => self::cursorInput($input),
                'before' => self::isDate($input['before'] ?? null)
                    ? new \DateTimeImmutable($input['before'])
                    : throw self::invalidInput('input.before must be an ISO 8601 date'),
            ],
            'subscription.get' => ['id' => self::stringInput($input, 'id', self::RECORD_ID_MAX_LENGTH)],
            'subscription.cancel' => [
                'id' => self::stringInput($input, 'id', self::RECORD_ID_MAX_LENGTH),
                'atPeriodEnd' => is_bool($input['atPeriodEnd'] ?? null)
                    ? $input['atPeriodEnd']
                    : throw self::invalidInput('input.atPeriodEnd must be a boolean'),
            ],
            'transaction.refund' => [
                'transactionId' => self::stringInput($input, 'transactionId', self::RECORD_ID_MAX_LENGTH),
                'amount' => array_key_exists('amount', $input) && self::minorAmountProblem($input, 'amount', 'input', optional: true) === null
                    ? $input['amount']
                    : throw self::invalidInput('input.amount must be a non-negative integer in minor units or null'),
                'reason' => self::stringInput($input, 'reason', self::REFUND_REASON_MAX_LENGTH, nullable: true, minLength: 0),
            ],
            default => throw new \LogicException(sprintf('No input rules for "%s"', $operation)),
        };
    }

    /**
     * The first way a result breaks the protocol, named by its field, or
     * `null` when it is valid.
     *
     * @param array<string, mixed> $input the parsed input of the request
     */
    public static function resultProblem(string $operation, array $input, mixed $result): ?string
    {
        return match ($operation) {
            'catalog.list' => self::pageProblem($result, self::catalogProductProblem(...)),
            'history.list' => self::pageProblem(
                $result,
                $input['kind'] === HistoryKind::Subscriptions ? self::subscriptionProblem(...) : self::transactionProblem(...),
            ),
            'subscription.get' => !self::isObject($result) || !array_key_exists('subscription', $result)
                ? 'result must be an object with subscription'
                : ($result['subscription'] === null ? null : self::subscriptionProblem($result['subscription'], 'result.subscription')),
            'subscription.cancel' => !self::isObject($result) || !array_key_exists('subscription', $result)
                ? 'result must be an object with subscription'
                : self::subscriptionProblem($result['subscription'], 'result.subscription'),
            'transaction.refund' => !self::isObject($result) || !array_key_exists('refund', $result)
                ? 'result must be an object with refund'
                : self::transactionProblem($result['refund'], 'result.refund')
                    ?? ($result['refund']['type'] === TransactionType::Refund->value ? null : 'result.refund.type must be refund'),
            default => throw new \LogicException(sprintf('No result rules for "%s"', $operation)),
        };
    }

    /** @param \Closure(mixed, string): ?string $itemProblem */
    private static function pageProblem(mixed $result, \Closure $itemProblem): ?string
    {
        if (!self::isObject($result)) {
            return 'result must be an object with items and nextCursor';
        }
        $items = $result['items'] ?? null;
        if (!is_array($items) || !array_is_list($items)) {
            return 'result.items must be a list';
        }
        if (count($items) > self::PAGE_MAX_ITEMS) {
            return sprintf('result.items must have at most %d items', self::PAGE_MAX_ITEMS);
        }
        foreach ($items as $index => $item) {
            $problem = $itemProblem($item, sprintf('result.items[%d]', $index));
            if ($problem !== null) {
                return $problem;
            }
        }
        if (!array_key_exists('nextCursor', $result) || !($result['nextCursor'] === null || is_string($result['nextCursor']))) {
            return 'result.nextCursor must be a string or null';
        }

        return null;
    }

    private static function catalogProductProblem(mixed $product, string $path): ?string
    {
        if (!self::isObject($product)) {
            return $path . ' must be an object';
        }

        return self::stringProblem($product, 'key', $path, self::IDENTIFIER_MAX_LENGTH)
            ?? self::stringProblem($product, 'name', $path, self::IDENTIFIER_MAX_LENGTH)
            ?? self::enumProblem($product, 'kind', $path, ProductKind::class);
    }

    private static function subscriptionProblem(mixed $subscription, string $path): ?string
    {
        if (!self::isObject($subscription)) {
            return $path . ' must be an object';
        }

        return self::stringProblem($subscription, 'id', $path, self::RECORD_ID_MAX_LENGTH)
            ?? self::stringProblem($subscription, 'distinctId', $path, self::IDENTIFIER_MAX_LENGTH, optional: true)
            ?? self::customerProblem($subscription, $path)
            ?? self::stringProblem($subscription, 'productKey', $path, self::IDENTIFIER_MAX_LENGTH)
            ?? self::enumProblem($subscription, 'status', $path, SubscriptionStatus::class)
            ?? self::dateProblem($subscription, 'currentPeriodStart', $path)
            ?? self::dateProblem($subscription, 'currentPeriodEnd', $path)
            ?? (is_bool($subscription['willRenew'] ?? null) ? null : $path . '.willRenew must be a boolean')
            ?? self::dateProblem($subscription, 'canceledAt', $path, optional: true)
            ?? self::dateProblem($subscription, 'updatedAt', $path);
    }

    private static function transactionProblem(mixed $transaction, string $path): ?string
    {
        if (!self::isObject($transaction)) {
            return $path . ' must be an object';
        }

        return self::stringProblem($transaction, 'id', $path, self::RECORD_ID_MAX_LENGTH)
            ?? self::enumProblem($transaction, 'type', $path, TransactionType::class)
            ?? self::stringProblem($transaction, 'distinctId', $path, self::IDENTIFIER_MAX_LENGTH, optional: true)
            ?? self::customerProblem($transaction, $path)
            ?? self::stringProblem($transaction, 'productKey', $path, self::IDENTIFIER_MAX_LENGTH, optional: true)
            ?? self::minorAmountProblem($transaction, 'amount', $path)
            ?? (is_string($transaction['currency'] ?? null) && mb_strlen($transaction['currency']) === 3
                ? null
                : $path . '.currency must be a 3-letter currency code')
            ?? self::minorAmountProblem($transaction, 'fee', $path, optional: true)
            ?? self::minorAmountProblem($transaction, 'tax', $path, optional: true)
            ?? self::dateProblem($transaction, 'occurredAt', $path)
            ?? self::stringProblem($transaction, 'subscriptionId', $path, self::RECORD_ID_MAX_LENGTH, optional: true)
            ?? self::dateProblem($transaction, 'periodStart', $path, optional: true)
            ?? self::dateProblem($transaction, 'periodEnd', $path, optional: true)
            ?? self::stringProblem($transaction, 'refundsTransactionId', $path, self::RECORD_ID_MAX_LENGTH, optional: true);
    }

    /** @param array<string, mixed> $record */
    private static function customerProblem(array $record, string $path): ?string
    {
        $customer = $record['customer'] ?? null;
        if ($customer === null) {
            return null;
        }
        if (!self::isObject($customer)) {
            return $path . '.customer must be an object or null';
        }

        return self::stringProblem($customer, 'externalId', $path . '.customer', self::IDENTIFIER_MAX_LENGTH);
    }

    /** @param array<string, mixed> $object */
    private static function stringProblem(array $object, string $key, string $path, int $maxLength, bool $optional = false): ?string
    {
        $value = $object[$key] ?? null;
        if ($value === null && $optional) {
            return null;
        }
        if (is_string($value) && $value !== '' && mb_strlen($value) <= $maxLength) {
            return null;
        }

        return sprintf('%s.%s must be a string of 1-%d characters', $path, $key, $maxLength);
    }

    /**
     * @param array<string, mixed> $object
     * @param class-string<\BackedEnum> $enum
     */
    private static function enumProblem(array $object, string $key, string $path, string $enum): ?string
    {
        $value = $object[$key] ?? null;
        if ((is_string($value) || is_int($value)) && $enum::tryFrom($value) !== null) {
            return null;
        }

        return sprintf(
            '%s.%s must be one of %s',
            $path,
            $key,
            implode(', ', array_map(static fn (\BackedEnum $case): string => (string) $case->value, $enum::cases())),
        );
    }

    /** @param array<string, mixed> $object */
    private static function minorAmountProblem(array $object, string $key, string $path, bool $optional = false): ?string
    {
        $value = $object[$key] ?? null;
        if (($value === null && $optional) || (is_int($value) && $value >= 0)) {
            return null;
        }

        return sprintf('%s.%s must be a non-negative integer in minor units', $path, $key);
    }

    /** @param array<string, mixed> $object */
    private static function dateProblem(array $object, string $key, string $path, bool $optional = false): ?string
    {
        $value = $object[$key] ?? null;
        if (($value === null && $optional) || self::isDate($value)) {
            return null;
        }

        return sprintf('%s.%s must be an ISO 8601 date', $path, $key);
    }

    /**
     * A string input that must be present; `nullable` lets its value be null.
     *
     * @param array<string, mixed> $input
     */
    private static function stringInput(array $input, string $key, int $maxLength, bool $nullable = false, int $minLength = 1): ?string
    {
        $value = $input[$key] ?? null;
        if (array_key_exists($key, $input) && $value === null && $nullable) {
            return null;
        }
        if (is_string($value) && mb_strlen($value) >= $minLength && mb_strlen($value) <= $maxLength) {
            return $value;
        }

        throw self::invalidInput(sprintf(
            'input.%s must be a string of %d-%d characters%s',
            $key,
            $minLength,
            $maxLength,
            $nullable ? ' or null' : '',
        ));
    }

    /** @param array<string, mixed> $input */
    private static function cursorInput(array $input): ?string
    {
        if (!array_key_exists('cursor', $input) || !($input['cursor'] === null || is_string($input['cursor']))) {
            throw self::invalidInput('input.cursor must be a string or null');
        }

        return $input['cursor'];
    }

    private static function isDate(mixed $value): bool
    {
        if (
            !is_string($value)
            || preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/', $value) !== 1
        ) {
            return false;
        }
        $parsed = date_parse($value);

        return $parsed['error_count'] === 0 && $parsed['warning_count'] === 0;
    }

    private static function isObject(mixed $value): bool
    {
        return is_array($value) && ($value === [] || !array_is_list($value));
    }

    private static function invalidInput(string $message): ProviderException
    {
        return new ProviderException(ProviderErrorCode::InvalidRequest, $message);
    }
}
