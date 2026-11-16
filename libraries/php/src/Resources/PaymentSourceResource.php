<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\CancelPaymentSourceSubscriptionBody;
use Voidhash\Generated\Core\Model\PaymentSourceCustomer;
use Voidhash\Generated\Core\Model\PaymentSourceSubscription;
use Voidhash\Generated\Core\Model\PaymentSourceTransaction;
use Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody;
use Voidhash\Generated\Core\Model\RecordPaymentSourceTransactionBody;
use Voidhash\Generated\Core\Model\RefundPaymentSourceTransactionBody;
use Voidhash\Internal\ProjectScope;
use Voidhash\Internal\ProviderProtocol;
use Voidhash\PaymentSources\Charge;
use Voidhash\PaymentSources\Refund;
use Voidhash\PaymentSources\SubscriptionState;

/**
 * Records one payment source's transactions and subscriptions under the
 * source's own ids. Recording is idempotent: the same request under the same
 * id returns the recorded result, so a retry is safe; a different request
 * under a recorded transaction id is refused with `conflict`
 * (`transaction_conflict`).
 *
 * {@see cancelSubscription()} and {@see refundTransaction()} instead ask the
 * source to act through its provider endpoint, and record what it answers.
 * When the endpoint cannot act they throw an {@see ApiException} with type
 * `conflict` (`payment_source_endpoint_not_configured`,
 * `payment_source_endpoint_unsupported`, `payment_source_endpoint_rejected`)
 * or `unavailable` (`payment_source_endpoint_unavailable`,
 * `payment_source_endpoint_invalid_response`), and a message saying why.
 *
 * The generated endpoints put ids into the path as they are; a source's own
 * ids may hold `/`, `?` or `#`, so they are encoded here.
 */
final class PaymentSourceResource
{
    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
        private readonly string $paymentProviderId,
    ) {
    }

    /** Records a charge under the source's transaction id. */
    public function charge(string $transactionId, Charge $charge): PaymentSourceTransaction
    {
        $body = (new RecordPaymentSourceTransactionBody())
            ->setType('charge')
            ->setProductKey($charge->productKey)
            ->setAmount($charge->amount)
            ->setCurrency($charge->currency)
            ->setOccurredAt(ProviderProtocol::formatDate($charge->occurredAt));
        // Left out, the key that sends the report decides its environment.
        if ($charge->environment !== null) {
            $body->setEnvironment($charge->environment->value);
        }
        if ($charge->distinctId !== null) {
            $body->setDistinctId($charge->distinctId);
        }
        if ($charge->customerId !== null) {
            $body->setCustomer((new PaymentSourceCustomer())->setExternalId($charge->customerId));
        }
        if ($charge->fee !== null) {
            $body->setFee($charge->fee);
        }
        if ($charge->tax !== null) {
            $body->setTax($charge->tax);
        }
        if ($charge->subscriptionId !== null) {
            $body->setSubscriptionId($charge->subscriptionId);
        }
        if ($charge->periodStart !== null) {
            $body->setPeriodStart(ProviderProtocol::formatDate($charge->periodStart));
        }
        if ($charge->periodEnd !== null) {
            $body->setPeriodEnd(ProviderProtocol::formatDate($charge->periodEnd));
        }

        return $this->recordTransaction($transactionId, $body);
    }

    /** Records a refund of an earlier charge under the source's transaction id. */
    public function refund(string $transactionId, Refund $refund): PaymentSourceTransaction
    {
        $body = (new RecordPaymentSourceTransactionBody())
            ->setType('refund')
            ->setRefundsTransactionId($refund->refundsTransactionId)
            ->setAmount($refund->amount)
            ->setCurrency($refund->currency)
            ->setOccurredAt(ProviderProtocol::formatDate($refund->occurredAt));
        // Left out, the key that sends the report decides its environment.
        if ($refund->environment !== null) {
            $body->setEnvironment($refund->environment->value);
        }
        if ($refund->distinctId !== null) {
            $body->setDistinctId($refund->distinctId);
        }
        if ($refund->customerId !== null) {
            $body->setCustomer((new PaymentSourceCustomer())->setExternalId($refund->customerId));
        }
        if ($refund->productKey !== null) {
            $body->setProductKey($refund->productKey);
        }
        if ($refund->fee !== null) {
            $body->setFee($refund->fee);
        }
        if ($refund->tax !== null) {
            $body->setTax($refund->tax);
        }

        return $this->recordTransaction($transactionId, $body);
    }

    /** Records the latest state of the subscription with the source's subscription id. */
    public function subscription(string $subscriptionId, SubscriptionState $state): PaymentSourceSubscription
    {
        $body = (new RecordPaymentSourceSubscriptionBody())
            ->setProductKey($state->productKey)
            ->setStatus($state->status->value)
            ->setCurrentPeriodStart(ProviderProtocol::formatDate($state->currentPeriodStart))
            ->setCurrentPeriodEnd(ProviderProtocol::formatDate($state->currentPeriodEnd))
            ->setIsAutoRenewing($state->isAutoRenewing)
            ->setUpdatedAt(ProviderProtocol::formatDate($state->updatedAt));
        // Left out, the key that sends the report decides its environment.
        if ($state->environment !== null) {
            $body->setEnvironment($state->environment->value);
        }
        if ($state->distinctId !== null) {
            $body->setDistinctId($state->distinctId);
        }
        if ($state->customerId !== null) {
            $body->setCustomer((new PaymentSourceCustomer())->setExternalId($state->customerId));
        }
        if ($state->canceledAt !== null) {
            $body->setCanceledAt(ProviderProtocol::formatDate($state->canceledAt));
        }

        return $this->core->paymentSourcesUpsertSubscription(
            $this->project->id(),
            $this->paymentProviderId,
            rawurlencode($subscriptionId),
            $body,
        ) ?? throw ApiException::unexpectedResponse();
    }

    /**
     * Asks the source to cancel the subscription with the source's
     * subscription id, at the end of its period (the default) or at once, and
     * returns the state it records afterwards.
     */
    public function cancelSubscription(string $subscriptionId, bool $isImmediate = false): PaymentSourceSubscription
    {
        return $this->core->paymentSourcesCancelSubscription(
            $this->project->id(),
            $this->paymentProviderId,
            rawurlencode($subscriptionId),
            (new CancelPaymentSourceSubscriptionBody())->setIsImmediate($isImmediate),
        ) ?? throw ApiException::unexpectedResponse();
    }

    /**
     * Asks the source to refund the charge with the source's transaction id:
     * `amount` in minor units, or everything left of it when `null`, with an
     * optional `reason` of at most 500 characters. Returns the refund it
     * records. Not to be confused with {@see refund()}, which reports a
     * refund the source already made.
     */
    public function refundTransaction(string $transactionId, ?int $amount = null, ?string $reason = null): PaymentSourceTransaction
    {
        $body = new RefundPaymentSourceTransactionBody();
        if ($amount !== null) {
            $body->setAmount($amount);
        }
        if ($reason !== null) {
            $body->setReason($reason);
        }

        return $this->core->paymentSourcesRefundTransaction(
            $this->project->id(),
            $this->paymentProviderId,
            rawurlencode($transactionId),
            $body,
        ) ?? throw ApiException::unexpectedResponse();
    }

    private function recordTransaction(string $transactionId, RecordPaymentSourceTransactionBody $body): PaymentSourceTransaction
    {
        return $this->core->paymentSourcesUpsertTransaction(
            $this->project->id(),
            $this->paymentProviderId,
            rawurlencode($transactionId),
            $body,
        ) ?? throw ApiException::unexpectedResponse();
    }
}
