<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionProjectionPlan
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
     * How often the plan renews.
     *
     * @var string
     */
    protected $billingPeriod;
    /**
     * The payment provider, such as `apple-app-store` or `stripe`.
     *
     * @var string
     */
    protected $store;
    /**
     * Paid subscriptions of the plan in the last three years.
     *
     * @var int
     */
    protected $subscriptions;
    /**
     * Where its renewals were learned: from the plan, from its billing period across stores while the plan has too few renewals, or not yet (`none`), which leaves projections that need them partial.
     *
     * @var string
     */
    protected $basis;
    /**
     * How often the plan renews.
     *
     * @return string
     */
    public function getBillingPeriod(): string
    {
        return $this->billingPeriod;
    }
    /**
     * How often the plan renews.
     *
     * @param string $billingPeriod
     *
     * @return self
     */
    public function setBillingPeriod(string $billingPeriod): self
    {
        $this->initialized['billingPeriod'] = true;
        $this->billingPeriod = $billingPeriod;
        return $this;
    }
    /**
     * The payment provider, such as `apple-app-store` or `stripe`.
     *
     * @return string
     */
    public function getStore(): string
    {
        return $this->store;
    }
    /**
     * The payment provider, such as `apple-app-store` or `stripe`.
     *
     * @param string $store
     *
     * @return self
     */
    public function setStore(string $store): self
    {
        $this->initialized['store'] = true;
        $this->store = $store;
        return $this;
    }
    /**
     * Paid subscriptions of the plan in the last three years.
     *
     * @return int
     */
    public function getSubscriptions(): int
    {
        return $this->subscriptions;
    }
    /**
     * Paid subscriptions of the plan in the last three years.
     *
     * @param int $subscriptions
     *
     * @return self
     */
    public function setSubscriptions(int $subscriptions): self
    {
        $this->initialized['subscriptions'] = true;
        $this->subscriptions = $subscriptions;
        return $this;
    }
    /**
     * Where its renewals were learned: from the plan, from its billing period across stores while the plan has too few renewals, or not yet (`none`), which leaves projections that need them partial.
     *
     * @return string
     */
    public function getBasis(): string
    {
        return $this->basis;
    }
    /**
     * Where its renewals were learned: from the plan, from its billing period across stores while the plan has too few renewals, or not yet (`none`), which leaves projections that need them partial.
     *
     * @param string $basis
     *
     * @return self
     */
    public function setBasis(string $basis): self
    {
        $this->initialized['basis'] = true;
        $this->basis = $basis;
        return $this;
    }
}