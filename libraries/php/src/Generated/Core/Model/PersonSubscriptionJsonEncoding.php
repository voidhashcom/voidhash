<?php

namespace Voidhash\Generated\Core\Model;

class PersonSubscriptionJsonEncoding
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
     * The subscription's id, `sub_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The name of the product subscribed to.
     *
     * @var string
     */
    protected $productName;
    /**
     * Where it was bought: `production`; `sandbox`, a store's own sandbox such as TestFlight or Google Play test purchases; or `test`, a simulated purchase of a debug build or a test mode such as Stripe's.
     *
     * @var string
     */
    protected $environment;
    /**
     * `active` while the subscription runs, `canceled` once it has ended.
     *
     * @var string
     */
    protected $status;
    /**
     * When the subscription started, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $startsAt;
    /**
     * When the current paid period ends; null when the store reported no end.
     *
     * @var string|null
     */
    protected $expiresAt;
    /**
     * When the store's billing grace period ends, during which access continues while it retries payment; null when there is none.
     *
     * @var string|null
     */
    protected $gracePeriodExpiresAt;
    /**
     * Whether the subscription ends at the end of its current period instead of renewing.
     *
     * @var bool
     */
    protected $isCancelingAtPeriodEnd;
    /**
     * @var PersonPurchasePaymentSource
     */
    protected $paymentSource;
    /**
     * The subscription's id, `sub_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The subscription's id, `sub_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The name of the product subscribed to.
     *
     * @return string
     */
    public function getProductName(): string
    {
        return $this->productName;
    }
    /**
     * The name of the product subscribed to.
     *
     * @param string $productName
     *
     * @return self
     */
    public function setProductName(string $productName): self
    {
        $this->initialized['productName'] = true;
        $this->productName = $productName;
        return $this;
    }
    /**
     * Where it was bought: `production`; `sandbox`, a store's own sandbox such as TestFlight or Google Play test purchases; or `test`, a simulated purchase of a debug build or a test mode such as Stripe's.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * Where it was bought: `production`; `sandbox`, a store's own sandbox such as TestFlight or Google Play test purchases; or `test`, a simulated purchase of a debug build or a test mode such as Stripe's.
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
    /**
     * `active` while the subscription runs, `canceled` once it has ended.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `active` while the subscription runs, `canceled` once it has ended.
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
     * When the subscription started, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStartsAt(): string
    {
        return $this->startsAt;
    }
    /**
     * When the subscription started, as an ISO 8601 timestamp.
     *
     * @param string $startsAt
     *
     * @return self
     */
    public function setStartsAt(string $startsAt): self
    {
        $this->initialized['startsAt'] = true;
        $this->startsAt = $startsAt;
        return $this;
    }
    /**
     * When the current paid period ends; null when the store reported no end.
     *
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
     * When the current paid period ends; null when the store reported no end.
     *
     * @param string|null $expiresAt
     *
     * @return self
     */
    public function setExpiresAt(?string $expiresAt): self
    {
        $this->initialized['expiresAt'] = true;
        $this->expiresAt = $expiresAt;
        return $this;
    }
    /**
     * When the store's billing grace period ends, during which access continues while it retries payment; null when there is none.
     *
     * @return string|null
     */
    public function getGracePeriodExpiresAt(): ?string
    {
        return $this->gracePeriodExpiresAt;
    }
    /**
     * When the store's billing grace period ends, during which access continues while it retries payment; null when there is none.
     *
     * @param string|null $gracePeriodExpiresAt
     *
     * @return self
     */
    public function setGracePeriodExpiresAt(?string $gracePeriodExpiresAt): self
    {
        $this->initialized['gracePeriodExpiresAt'] = true;
        $this->gracePeriodExpiresAt = $gracePeriodExpiresAt;
        return $this;
    }
    /**
     * Whether the subscription ends at the end of its current period instead of renewing.
     *
     * @return bool
     */
    public function getIsCancelingAtPeriodEnd(): bool
    {
        return $this->isCancelingAtPeriodEnd;
    }
    /**
     * Whether the subscription ends at the end of its current period instead of renewing.
     *
     * @param bool $isCancelingAtPeriodEnd
     *
     * @return self
     */
    public function setIsCancelingAtPeriodEnd(bool $isCancelingAtPeriodEnd): self
    {
        $this->initialized['isCancelingAtPeriodEnd'] = true;
        $this->isCancelingAtPeriodEnd = $isCancelingAtPeriodEnd;
        return $this;
    }
    /**
     * @return PersonPurchasePaymentSource
     */
    public function getPaymentSource(): PersonPurchasePaymentSource
    {
        return $this->paymentSource;
    }
    /**
     * @param PersonPurchasePaymentSource $paymentSource
     *
     * @return self
     */
    public function setPaymentSource(PersonPurchasePaymentSource $paymentSource): self
    {
        $this->initialized['paymentSource'] = true;
        $this->paymentSource = $paymentSource;
        return $this;
    }
}