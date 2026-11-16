<?php

declare(strict_types=1);

namespace Voidhash\Example\Billing;

use Voidhash\Example\Nimbus\StateFile;

/**
 * A stand-in for a billing provider Voidhash does not integrate natively —
 * the part of this example you replace with your provider's API client.
 *
 * It sells two products, opens checkouts, and keeps subscriptions and
 * transactions (charges and refunds) in a {@see StateFile}, so a cancel or a
 * refund made through one request is still there on the next. Records are
 * plain arrays in this fake's own shape; {@see FakePayProvider} translates
 * them for Voidhash.
 */
final class FakePay
{
    /** @var array<string, array{name: string, kind: string, amount: int, currency: string}> */
    public const PRODUCTS = [
        'fakepay_pro_monthly' => ['name' => 'Nimbus Pro (monthly)', 'kind' => 'subscription', 'amount' => 999, 'currency' => 'USD'],
        'fakepay_pro_lifetime' => ['name' => 'Nimbus Pro (lifetime)', 'kind' => 'one_time', 'amount' => 4900, 'currency' => 'USD'],
    ];

    private const CHECKOUT_LIFETIME = 'PT1H';

    public function __construct(private readonly StateFile $state)
    {
    }

    /** @return list<array<string, mixed>> subscriptions, oldest first */
    public function subscriptions(): array
    {
        return array_values($this->state->read()['subscriptions'] ?? []);
    }

    /** @return list<array<string, mixed>> charges and refunds, oldest first */
    public function transactions(): array
    {
        return array_values($this->state->read()['transactions'] ?? []);
    }

    /** @return array<string, mixed>|null */
    public function subscription(string $id): ?array
    {
        return $this->state->read()['subscriptions'][$id] ?? null;
    }

    /** @return array<string, mixed>|null */
    public function transaction(string $id): ?array
    {
        return $this->state->read()['transactions'][$id] ?? null;
    }

    /**
     * Stops a subscription renewing, or ends it now.
     *
     * @return array<string, mixed>|null the subscription afterwards, or null when there is none
     */
    public function cancelSubscription(string $id, bool $atPeriodEnd): ?array
    {
        $canceled = null;
        $this->state->mutate(static function (array $state) use ($id, $atPeriodEnd, &$canceled): array {
            $subscription = $state['subscriptions'][$id] ?? null;
            if ($subscription === null) {
                return $state;
            }
            $now = self::now();
            $subscription['willRenew'] = false;
            $subscription['canceledAt'] ??= $now;
            $subscription['updatedAt'] = $now;
            if (!$atPeriodEnd) {
                $subscription['status'] = 'canceled';
                $subscription['currentPeriodEnd'] = $now;
            }
            $state['subscriptions'][$id] = $canceled = $subscription;

            return $state;
        });

        return $canceled;
    }

    /**
     * Refunds `amount` of a charge, or everything left of it when null.
     *
     * @return array<string, mixed> the refund transaction
     *
     * @throws \OutOfBoundsException when there is no such charge
     * @throws \DomainException when the charge has less left than `amount`
     */
    public function refund(string $chargeId, ?int $amount): array
    {
        $refund = null;
        $this->state->mutate(static function (array $state) use ($chargeId, $amount, &$refund): array {
            $charge = $state['transactions'][$chargeId] ?? null;
            if ($charge === null || $charge['type'] !== 'charge') {
                throw new \OutOfBoundsException(sprintf('No charge %s', $chargeId));
            }
            $refunded = array_sum(array_map(
                static fn (array $transaction): int => $transaction['refundsTransactionId'] === $chargeId ? $transaction['amount'] : 0,
                $state['transactions'],
            ));
            $left = $charge['amount'] - $refunded;
            $amount ??= $left;
            if ($amount === 0 || $amount > $left) {
                throw new \DomainException(sprintf('Charge %s has %d left to refund', $chargeId, $left));
            }

            $refund = [
                'id' => 'fp_txn_' . bin2hex(random_bytes(6)),
                'type' => 'refund',
                'distinctId' => $charge['distinctId'],
                'customerId' => $charge['customerId'],
                'productKey' => $charge['productKey'],
                'amount' => $amount,
                'currency' => $charge['currency'],
                'occurredAt' => self::now(),
                'subscriptionId' => null,
                'refundsTransactionId' => $chargeId,
            ];
            $state['transactions'][$refund['id']] = $refund;

            return $state;
        });

        return $refund;
    }

    /**
     * Opens a checkout for one product; the buyer pays on the returned URL.
     * Your server calls this, not Voidhash, and stores the buyer's Voidhash
     * distinct id on the checkout (with a real provider, in its metadata), so
     * the payment it ends in names the same person.
     *
     * @return array{id: string, url: string, expiresAt: string}
     *
     * @throws \OutOfBoundsException when the product is not sold here
     */
    public function createCheckout(string $productKey, string $distinctId, string $successUrl): array
    {
        if (!isset(self::PRODUCTS[$productKey])) {
            throw new \OutOfBoundsException(sprintf('No product %s', $productKey));
        }
        $id = 'fp_co_' . bin2hex(random_bytes(6));
        $checkout = [
            'id' => $id,
            'url' => 'https://checkout.fakepay.example/' . $id,
            'expiresAt' => (new \DateTimeImmutable(self::now()))->add(new \DateInterval(self::CHECKOUT_LIFETIME))->format(\DATE_ATOM),
        ];
        $this->state->mutate(static function (array $state) use ($checkout, $productKey, $distinctId, $successUrl): array {
            $state['checkouts'][$checkout['id']] = [
                ...$checkout,
                'productKey' => $productKey,
                'distinctId' => $distinctId,
                'customerId' => 'fp_cus_' . bin2hex(random_bytes(6)),
                'successUrl' => $successUrl,
            ];

            return $state;
        });

        return $checkout;
    }

    /**
     * Plays the buyer paying for a checkout: records the charge and, for a
     * subscription product, the subscription it starts.
     *
     * @return array{transactionId: string, subscriptionId: string|null}
     *
     * @throws \OutOfBoundsException when there is no such open checkout
     */
    public function completeCheckout(string $checkoutId): array
    {
        $completed = null;
        $this->state->mutate(static function (array $state) use ($checkoutId, &$completed): array {
            $checkout = $state['checkouts'][$checkoutId] ?? null;
            if ($checkout === null) {
                throw new \OutOfBoundsException(sprintf('No open checkout %s', $checkoutId));
            }
            unset($state['checkouts'][$checkoutId]);

            $product = self::PRODUCTS[$checkout['productKey']];
            $now = new \DateTimeImmutable(self::now());
            $subscriptionId = null;
            $periodEnd = $now->add(new \DateInterval('P1M'))->format(\DATE_ATOM);
            if ($product['kind'] === 'subscription') {
                $subscriptionId = 'fp_sub_' . bin2hex(random_bytes(6));
                $state['subscriptions'][$subscriptionId] = [
                    'id' => $subscriptionId,
                    'distinctId' => $checkout['distinctId'],
                    'customerId' => $checkout['customerId'],
                    'productKey' => $checkout['productKey'],
                    'status' => 'active',
                    'currentPeriodStart' => $now->format(\DATE_ATOM),
                    'currentPeriodEnd' => $periodEnd,
                    'willRenew' => true,
                    'canceledAt' => null,
                    'updatedAt' => $now->format(\DATE_ATOM),
                ];
            }
            $transactionId = 'fp_txn_' . bin2hex(random_bytes(6));
            $state['transactions'][$transactionId] = [
                'id' => $transactionId,
                'type' => 'charge',
                'distinctId' => $checkout['distinctId'],
                'customerId' => $checkout['customerId'],
                'productKey' => $checkout['productKey'],
                'amount' => $product['amount'],
                'currency' => $product['currency'],
                'occurredAt' => $now->format(\DATE_ATOM),
                'subscriptionId' => $subscriptionId,
                'periodStart' => $subscriptionId === null ? null : $now->format(\DATE_ATOM),
                'periodEnd' => $subscriptionId === null ? null : $periodEnd,
                'refundsTransactionId' => null,
            ];
            $completed = ['transactionId' => $transactionId, 'subscriptionId' => $subscriptionId];

            return $state;
        });

        return $completed;
    }

    private static function now(): string
    {
        return gmdate(\DATE_ATOM);
    }
}
