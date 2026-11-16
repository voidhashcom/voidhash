<?php

namespace Voidhash\Generated\Core\Model;

class RecordPaymentSourceSubscriptionBody
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
     * The buyer's distinct id. With `customer` as well, it identifies the source's customer as that person.
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
     * The source's key for the subscription product, as mapped to a product.
     *
     * @var string
     */
    protected $productKey;
    /**
     * `trialing` starts a free trial for the current period; `active` keeps access through paid periods; `past_due` keeps access while the source retries the payment; `canceled` ends access at `canceledAt` (or `updatedAt` when it's left out); `expired` ends it at the current period's end.
     *
     * @var string
     */
    protected $status;
    /**
     * The start of the current period, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $currentPeriodStart;
    /**
     * The end of the current period, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $currentPeriodEnd;
    /**
     * Whether the subscription renews at the end of the current period; `false` cancels it at the period's end, `true` again resumes it.
     *
     * @var bool
     */
    protected $isAutoRenewing;
    /**
     * When a `canceled` subscription's access ends, as an ISO 8601 timestamp; `updatedAt` when left out.
     *
     * @var string|null
     */
    protected $canceledAt;
    /**
     * When the source last changed the subscription, as an ISO 8601 timestamp; an older update never overwrites a newer one.
     *
     * @var string
     */
    protected $updatedAt;
    /**
     * `production`, or `test` for test payments such as a staging deployment's; test purchases stay out of production revenue.
     *
     * @var string
     */
    protected $environment;
    /**
     * The buyer's distinct id. With `customer` as well, it identifies the source's customer as that person.
     *
     * @return string|null
     */
    public function getDistinctId(): ?string
    {
        return $this->distinctId;
    }
    /**
     * The buyer's distinct id. With `customer` as well, it identifies the source's customer as that person.
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
     * The source's key for the subscription product, as mapped to a product.
     *
     * @return string
     */
    public function getProductKey(): string
    {
        return $this->productKey;
    }
    /**
     * The source's key for the subscription product, as mapped to a product.
     *
     * @param string $productKey
     *
     * @return self
     */
    public function setProductKey(string $productKey): self
    {
        $this->initialized['productKey'] = true;
        $this->productKey = $productKey;
        return $this;
    }
    /**
     * `trialing` starts a free trial for the current period; `active` keeps access through paid periods; `past_due` keeps access while the source retries the payment; `canceled` ends access at `canceledAt` (or `updatedAt` when it's left out); `expired` ends it at the current period's end.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `trialing` starts a free trial for the current period; `active` keeps access through paid periods; `past_due` keeps access while the source retries the payment; `canceled` ends access at `canceledAt` (or `updatedAt` when it's left out); `expired` ends it at the current period's end.
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * The start of the current period, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCurrentPeriodStart(): string
    {
        return $this->currentPeriodStart;
    }
    /**
     * The start of the current period, as an ISO 8601 timestamp.
     *
     * @param string $currentPeriodStart
     *
     * @return self
     */
    public function setCurrentPeriodStart(string $currentPeriodStart): self
    {
        $this->initialized['currentPeriodStart'] = true;
        $this->currentPeriodStart = $currentPeriodStart;
        return $this;
    }
    /**
     * The end of the current period, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCurrentPeriodEnd(): string
    {
        return $this->currentPeriodEnd;
    }
    /**
     * The end of the current period, as an ISO 8601 timestamp.
     *
     * @param string $currentPeriodEnd
     *
     * @return self
     */
    public function setCurrentPeriodEnd(string $currentPeriodEnd): self
    {
        $this->initialized['currentPeriodEnd'] = true;
        $this->currentPeriodEnd = $currentPeriodEnd;
        return $this;
    }
    /**
     * Whether the subscription renews at the end of the current period; `false` cancels it at the period's end, `true` again resumes it.
     *
     * @return bool
     */
    public function getIsAutoRenewing(): bool
    {
        return $this->isAutoRenewing;
    }
    /**
     * Whether the subscription renews at the end of the current period; `false` cancels it at the period's end, `true` again resumes it.
     *
     * @param bool $isAutoRenewing
     *
     * @return self
     */
    public function setIsAutoRenewing(bool $isAutoRenewing): self
    {
        $this->initialized['isAutoRenewing'] = true;
        $this->isAutoRenewing = $isAutoRenewing;
        return $this;
    }
    /**
     * When a `canceled` subscription's access ends, as an ISO 8601 timestamp; `updatedAt` when left out.
     *
     * @return string|null
     */
    public function getCanceledAt(): ?string
    {
        return $this->canceledAt;
    }
    /**
     * When a `canceled` subscription's access ends, as an ISO 8601 timestamp; `updatedAt` when left out.
     *
     * @param string|null $canceledAt
     *
     * @return self
     */
    public function setCanceledAt(?string $canceledAt): self
    {
        $this->initialized['canceledAt'] = true;
        $this->canceledAt = $canceledAt;
        return $this;
    }
    /**
     * When the source last changed the subscription, as an ISO 8601 timestamp; an older update never overwrites a newer one.
     *
     * @return string
     */
    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }
    /**
     * When the source last changed the subscription, as an ISO 8601 timestamp; an older update never overwrites a newer one.
     *
     * @param string $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
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