<?php

declare(strict_types=1);

namespace Voidhash\Example\Billing;

use Voidhash\PaymentSources\SubscriptionStatus;
use Voidhash\Provider\CancelSubscriptionRequest;
use Voidhash\Provider\CatalogPage;
use Voidhash\Provider\CatalogProduct;
use Voidhash\Provider\CatalogRequest;
use Voidhash\Provider\CatalogSource;
use Voidhash\Provider\HistoryKind;
use Voidhash\Provider\HistoryPage;
use Voidhash\Provider\HistoryRequest;
use Voidhash\Provider\HistorySource;
use Voidhash\Provider\ProductKind;
use Voidhash\Provider\ProviderErrorCode;
use Voidhash\Provider\ProviderException;
use Voidhash\Provider\RefundTransactionRequest;
use Voidhash\Provider\Subscription;
use Voidhash\Provider\SubscriptionCancellation;
use Voidhash\Provider\SubscriptionRequest;
use Voidhash\Provider\SubscriptionSource;
use Voidhash\Provider\Transaction;
use Voidhash\Provider\TransactionRefunds;
use Voidhash\Provider\TransactionType;

/**
 * Answers Voidhash's requests about FakePay. Each interface implemented here
 * is one operation the endpoint supports:
 *
 * - catalog.list imports the products,
 * - history.list imports past subscriptions and transactions,
 * - subscription.get refreshes a subscription Voidhash is unsure about,
 * - subscription.cancel and transaction.refund carry out a cancel or a
 *   refund started in Voidhash.
 *
 * The SDK verifies each request and checks every answer before it is sent;
 * this class only translates between FakePay's records and the SDK's types.
 */
final class FakePayProvider implements CatalogSource, HistorySource, SubscriptionSource, SubscriptionCancellation, TransactionRefunds
{
    private const PAGE_SIZE = 100;

    public function __construct(private readonly FakePay $fakePay)
    {
    }

    public function listCatalog(CatalogRequest $request): CatalogPage
    {
        $products = [];
        foreach (FakePay::PRODUCTS as $key => $product) {
            $products[] = new CatalogProduct($key, $product['name'], ProductKind::from($product['kind']));
        }

        return new CatalogPage($products);
    }

    /**
     * Pages the records created before `before`; the cursor is the offset of
     * the next page.
     */
    public function listHistory(HistoryRequest $request): HistoryPage
    {
        $records = $request->kind === HistoryKind::Subscriptions
            ? array_map(self::subscription(...), $this->fakePay->subscriptions())
            : array_map(self::transaction(...), $this->fakePay->transactions());
        $before = array_values(array_filter(
            $records,
            static fn (Subscription|Transaction $record): bool => ($record instanceof Subscription ? $record->currentPeriodStart : $record->occurredAt) < $request->before,
        ));
        $offset = (int) ($request->cursor ?? 0);
        $nextOffset = $offset + self::PAGE_SIZE;

        return new HistoryPage(
            array_slice($before, $offset, self::PAGE_SIZE),
            $nextOffset < count($before) ? (string) $nextOffset : null,
        );
    }

    public function getSubscription(SubscriptionRequest $request): ?Subscription
    {
        $subscription = $this->fakePay->subscription($request->id);

        return $subscription === null ? null : self::subscription($subscription);
    }

    public function cancelSubscription(CancelSubscriptionRequest $request): Subscription
    {
        $subscription = $this->fakePay->cancelSubscription($request->id, $request->atPeriodEnd)
            ?? throw new ProviderException(ProviderErrorCode::NotFound, sprintf('FakePay has no subscription %s', $request->id));

        return self::subscription($subscription);
    }

    public function refundTransaction(RefundTransactionRequest $request): Transaction
    {
        try {
            return self::transaction($this->fakePay->refund($request->transactionId, $request->amount));
        } catch (\OutOfBoundsException $exception) {
            throw new ProviderException(ProviderErrorCode::NotFound, $exception->getMessage());
        } catch (\DomainException $exception) {
            throw new ProviderException(ProviderErrorCode::InvalidRequest, $exception->getMessage());
        }
    }

    /**
     * A FakePay subscription as Voidhash reads it.
     *
     * @param array<string, mixed> $subscription
     */
    public static function subscription(array $subscription): Subscription
    {
        return new Subscription(
            id: $subscription['id'],
            productKey: $subscription['productKey'],
            status: SubscriptionStatus::from($subscription['status']),
            currentPeriodStart: new \DateTimeImmutable($subscription['currentPeriodStart']),
            currentPeriodEnd: new \DateTimeImmutable($subscription['currentPeriodEnd']),
            willRenew: $subscription['willRenew'],
            updatedAt: new \DateTimeImmutable($subscription['updatedAt']),
            distinctId: $subscription['distinctId'],
            customerId: $subscription['customerId'],
            canceledAt: $subscription['canceledAt'] === null ? null : new \DateTimeImmutable($subscription['canceledAt']),
        );
    }

    /**
     * A FakePay charge or refund as Voidhash reads it.
     *
     * @param array<string, mixed> $transaction
     */
    public static function transaction(array $transaction): Transaction
    {
        return new Transaction(
            id: $transaction['id'],
            type: TransactionType::from($transaction['type']),
            amount: $transaction['amount'],
            currency: $transaction['currency'],
            occurredAt: new \DateTimeImmutable($transaction['occurredAt']),
            distinctId: $transaction['distinctId'],
            customerId: $transaction['customerId'],
            productKey: $transaction['productKey'],
            subscriptionId: $transaction['subscriptionId'],
            periodStart: isset($transaction['periodStart']) ? new \DateTimeImmutable($transaction['periodStart']) : null,
            periodEnd: isset($transaction['periodEnd']) ? new \DateTimeImmutable($transaction['periodEnd']) : null,
            refundsTransactionId: $transaction['refundsTransactionId'],
        );
    }
}
