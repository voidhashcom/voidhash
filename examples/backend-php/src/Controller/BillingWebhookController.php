<?php

declare(strict_types=1);

namespace Voidhash\Example\Controller;

use Voidhash\Example\Billing\FakePay;
use Voidhash\Example\Billing\FakePayProvider;
use Voidhash\Example\Exception\HttpException;
use Voidhash\Example\Request;
use Voidhash\Example\Response;
use Voidhash\PaymentSources\Charge;
use Voidhash\PaymentSources\Refund;
use Voidhash\PaymentSources\SubscriptionState;
use Voidhash\Provider\TransactionType;
use Voidhash\Resources\PaymentSourceResource;

final class BillingWebhookController
{
    /** @param PaymentSourceResource|null $source null while VOIDHASH_PAYMENT_SOURCE_ID is not set */
    public function __construct(
        private readonly FakePay $fakePay,
        private readonly ?PaymentSourceResource $source,
    ) {
    }

    /**
     * `POST /billing/webhook` — FakePay telling us a payment or a subscription
     * changed, reported on to Voidhash with the payment sources push API.
     *
     * The event only names the record; its current state is read back from
     * FakePay, so events arriving out of order still report the latest state.
     * A real provider signs its webhooks: verify that signature here, before
     * trusting the event.
     *
     * Reporting is idempotent, so the provider retrying a delivery is safe,
     * and so is a refund or cancel that started in Voidhash being reported
     * again: Voidhash already recorded it under the same id. A failure to
     * reach Voidhash surfaces as a 503, which makes the provider retry.
     */
    public function __invoke(Request $request): Response
    {
        if ($this->source === null) {
            return Response::error(503, 'payment_source_not_configured', 'VOIDHASH_PAYMENT_SOURCE_ID is not set on this server');
        }
        $event = $request->json();
        $type = Request::requireString($event, 'type');
        $id = Request::requireString($event, 'id');

        match ($type) {
            'transaction.completed' => $this->reportTransaction($id),
            'subscription.updated' => $this->reportSubscription($id),
            default => throw HttpException::badRequest('unknown_event', sprintf('unknown event type "%s"', $type)),
        };

        return Response::json(200, ['received' => true, 'type' => $type]);
    }

    private function reportTransaction(string $id): void
    {
        $record = $this->fakePay->transaction($id)
            ?? throw HttpException::notFound('unknown_transaction', sprintf('FakePay has no transaction %s', $id));
        $transaction = FakePayProvider::transaction($record);

        if ($transaction->type === TransactionType::Refund) {
            $this->source->refund($transaction->id, new Refund(
                refundsTransactionId: (string) $transaction->refundsTransactionId,
                amount: $transaction->amount,
                currency: $transaction->currency,
                occurredAt: $transaction->occurredAt,
                distinctId: $transaction->distinctId,
                customerId: $transaction->customerId,
                productKey: $transaction->productKey,
            ));

            return;
        }

        // A charge for a subscription period names the subscription and the
        // period it pays for; without them it completes a one-time purchase.
        $this->source->charge($transaction->id, new Charge(
            productKey: (string) $transaction->productKey,
            amount: $transaction->amount,
            currency: $transaction->currency,
            occurredAt: $transaction->occurredAt,
            distinctId: $transaction->distinctId,
            customerId: $transaction->customerId,
            subscriptionId: $transaction->subscriptionId,
            periodStart: $transaction->periodStart,
            periodEnd: $transaction->periodEnd,
        ));
    }

    private function reportSubscription(string $id): void
    {
        $record = $this->fakePay->subscription($id)
            ?? throw HttpException::notFound('unknown_subscription', sprintf('FakePay has no subscription %s', $id));
        $subscription = FakePayProvider::subscription($record);

        $this->source->subscription($subscription->id, new SubscriptionState(
            productKey: $subscription->productKey,
            status: $subscription->status,
            currentPeriodStart: $subscription->currentPeriodStart,
            currentPeriodEnd: $subscription->currentPeriodEnd,
            isAutoRenewing: $subscription->willRenew,
            updatedAt: $subscription->updatedAt,
            distinctId: $subscription->distinctId,
            customerId: $subscription->customerId,
            canceledAt: $subscription->canceledAt,
        ));
    }
}
