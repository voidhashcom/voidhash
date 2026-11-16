<?php

namespace Voidhash\Generated\Core\Model;

class RecordPaymentSourceTransactionBody
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * `charge` for a payment, `refund` for money returned on a recorded charge.
     *
     * @var string
     */
    protected $type;
    /**
     * The buyer's distinct id; a refund takes the charge's buyer. With `customer` as well, it identifies the source's customer as that person.
     *
     * @var string|null
     */
    protected $distinctId;
    /**
     * The source's own customer, for buyers without a Voidhash distinct id.
     *
     * @var PaymentSourceCustomer
     */
    protected $customer;
    /**
     * The source's key for the product paid for, as mapped to a product; required for a charge, a refund takes the charge's.
     *
     * @var string|null
     */
    protected $productKey;
    /**
     * The amount charged or refunded, tax included, in the currency's minor units.
     *
     * @var int
     */
    protected $amount;
    /**
     * The ISO 4217 currency code; a refund's must match its charge's.
     *
     * @var string
     */
    protected $currency;
    /**
     * The source's commission, in minor units.
     *
     * @var int|null
     */
    protected $fee;
    /**
     * The tax included in `amount`, in minor units.
     *
     * @var int|null
     */
    protected $tax;
    /**
     * When the payment or refund happened, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $occurredAt;
    /**
     * The source's id for the subscription (see `PUT .../subscriptions/{externalId}`) whose period this charge pays for. Requires `periodStart`, `periodEnd` and a product that is a subscription.
     *
     * @var string|null
     */
    protected $subscriptionId;
    /**
     * The start of the subscription period a charge with `subscriptionId` pays for, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $periodStart;
    /**
     * The end of the subscription period a charge with `subscriptionId` pays for, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $periodEnd;
    /**
     * The source's id for the charge a refund refunds; required for a refund.
     *
     * @var string|null
     */
    protected $refundsTransactionId;
    /**
     * `production`, or `test` for test payments such as a staging deployment's; test purchases stay out of production revenue.
     *
     * @var string
     */
    protected $environment;
    /**
     * `charge` for a payment, `refund` for money returned on a recorded charge.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * `charge` for a payment, `refund` for money returned on a recorded charge.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * The buyer's distinct id; a refund takes the charge's buyer. With `customer` as well, it identifies the source's customer as that person.
     *
     * @return string|null
     */
    public function getDistinctId(): ?string
    {
        return $this->distinctId;
    }
    /**
     * The buyer's distinct id; a refund takes the charge's buyer. With `customer` as well, it identifies the source's customer as that person.
     *
     * @param string|null $distinctId
     *
     * @return self
     */
    public function setDistinctId(?string $distinctId): self
    {
        $this->initialized['distinctId'] = true;
        $this->distinctId = $distinctId;
        return $this;
    }
    /**
     * The source's own customer, for buyers without a Voidhash distinct id.
     *
     * @return PaymentSourceCustomer
     */
    public function getCustomer(): PaymentSourceCustomer
    {
        return $this->customer;
    }
    /**
     * The source's own customer, for buyers without a Voidhash distinct id.
     *
     * @param PaymentSourceCustomer $customer
     *
     * @return self
     */
    public function setCustomer(PaymentSourceCustomer $customer): self
    {
        $this->initialized['customer'] = true;
        $this->customer = $customer;
        return $this;
    }
    /**
     * The source's key for the product paid for, as mapped to a product; required for a charge, a refund takes the charge's.
     *
     * @return string|null
     */
    public function getProductKey(): ?string
    {
        return $this->productKey;
    }
    /**
     * The source's key for the product paid for, as mapped to a product; required for a charge, a refund takes the charge's.
     *
     * @param string|null $productKey
     *
     * @return self
     */
    public function setProductKey(?string $productKey): self
    {
        $this->initialized['productKey'] = true;
        $this->productKey = $productKey;
        return $this;
    }
    /**
     * The amount charged or refunded, tax included, in the currency's minor units.
     *
     * @return int
     */
    public function getAmount(): int
    {
        return $this->amount;
    }
    /**
     * The amount charged or refunded, tax included, in the currency's minor units.
     *
     * @param int $amount
     *
     * @return self
     */
    public function setAmount(int $amount): self
    {
        $this->initialized['amount'] = true;
        $this->amount = $amount;
        return $this;
    }
    /**
     * The ISO 4217 currency code; a refund's must match its charge's.
     *
     * @return string
     */
    public function getCurrency(): string
    {
        return $this->currency;
    }
    /**
     * The ISO 4217 currency code; a refund's must match its charge's.
     *
     * @param string $currency
     *
     * @return self
     */
    public function setCurrency(string $currency): self
    {
        $this->initialized['currency'] = true;
        $this->currency = $currency;
        return $this;
    }
    /**
     * The source's commission, in minor units.
     *
     * @return int|null
     */
    public function getFee(): ?int
    {
        return $this->fee;
    }
    /**
     * The source's commission, in minor units.
     *
     * @param int|null $fee
     *
     * @return self
     */
    public function setFee(?int $fee): self
    {
        $this->initialized['fee'] = true;
        $this->fee = $fee;
        return $this;
    }
    /**
     * The tax included in `amount`, in minor units.
     *
     * @return int|null
     */
    public function getTax(): ?int
    {
        return $this->tax;
    }
    /**
     * The tax included in `amount`, in minor units.
     *
     * @param int|null $tax
     *
     * @return self
     */
    public function setTax(?int $tax): self
    {
        $this->initialized['tax'] = true;
        $this->tax = $tax;
        return $this;
    }
    /**
     * When the payment or refund happened, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getOccurredAt(): string
    {
        return $this->occurredAt;
    }
    /**
     * When the payment or refund happened, as an ISO 8601 timestamp.
     *
     * @param string $occurredAt
     *
     * @return self
     */
    public function setOccurredAt(string $occurredAt): self
    {
        $this->initialized['occurredAt'] = true;
        $this->occurredAt = $occurredAt;
        return $this;
    }
    /**
     * The source's id for the subscription (see `PUT .../subscriptions/{externalId}`) whose period this charge pays for. Requires `periodStart`, `periodEnd` and a product that is a subscription.
     *
     * @return string|null
     */
    public function getSubscriptionId(): ?string
    {
        return $this->subscriptionId;
    }
    /**
     * The source's id for the subscription (see `PUT .../subscriptions/{externalId}`) whose period this charge pays for. Requires `periodStart`, `periodEnd` and a product that is a subscription.
     *
     * @param string|null $subscriptionId
     *
     * @return self
     */
    public function setSubscriptionId(?string $subscriptionId): self
    {
        $this->initialized['subscriptionId'] = true;
        $this->subscriptionId = $subscriptionId;
        return $this;
    }
    /**
     * The start of the subscription period a charge with `subscriptionId` pays for, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getPeriodStart(): ?string
    {
        return $this->periodStart;
    }
    /**
     * The start of the subscription period a charge with `subscriptionId` pays for, as an ISO 8601 timestamp.
     *
     * @param string|null $periodStart
     *
     * @return self
     */
    public function setPeriodStart(?string $periodStart): self
    {
        $this->initialized['periodStart'] = true;
        $this->periodStart = $periodStart;
        return $this;
    }
    /**
     * The end of the subscription period a charge with `subscriptionId` pays for, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getPeriodEnd(): ?string
    {
        return $this->periodEnd;
    }
    /**
     * The end of the subscription period a charge with `subscriptionId` pays for, as an ISO 8601 timestamp.
     *
     * @param string|null $periodEnd
     *
     * @return self
     */
    public function setPeriodEnd(?string $periodEnd): self
    {
        $this->initialized['periodEnd'] = true;
        $this->periodEnd = $periodEnd;
        return $this;
    }
    /**
     * The source's id for the charge a refund refunds; required for a refund.
     *
     * @return string|null
     */
    public function getRefundsTransactionId(): ?string
    {
        return $this->refundsTransactionId;
    }
    /**
     * The source's id for the charge a refund refunds; required for a refund.
     *
     * @param string|null $refundsTransactionId
     *
     * @return self
     */
    public function setRefundsTransactionId(?string $refundsTransactionId): self
    {
        $this->initialized['refundsTransactionId'] = true;
        $this->refundsTransactionId = $refundsTransactionId;
        return $this;
    }
    /**
     * `production`, or `test` for test payments such as a staging deployment's; test purchases stay out of production revenue.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * `production`, or `test` for test payments such as a staging deployment's; test purchases stay out of production revenue.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
}