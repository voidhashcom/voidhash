<?php

namespace Voidhash\Generated\Core\Model;

class PersonPurchaseJsonEncoding
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
     * The purchase's id, `pur_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The name of the product bought.
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
     * When the purchase was made, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * When the purchase was refunded; null unless it was.
     *
     * @var string|null
     */
    protected $refundedAt;
    /**
     * When the store revoked the purchase; null unless it did.
     *
     * @var string|null
     */
    protected $revokedAt;
    /**
     * @var PersonPurchasePaymentSource
     */
    protected $paymentSource;
    /**
     * The purchase's id, `pur_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The purchase's id, `pur_...`.
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
     * The name of the product bought.
     *
     * @return string
     */
    public function getProductName(): string
    {
        return $this->productName;
    }
    /**
     * The name of the product bought.
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
     * When the purchase was made, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the purchase was made, as an ISO 8601 timestamp.
     *
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * When the purchase was refunded; null unless it was.
     *
     * @return string|null
     */
    public function getRefundedAt(): ?string
    {
        return $this->refundedAt;
    }
    /**
     * When the purchase was refunded; null unless it was.
     *
     * @param string|null $refundedAt
     *
     * @return self
     */
    public function setRefundedAt(?string $refundedAt): self
    {
        $this->initialized['refundedAt'] = true;
        $this->refundedAt = $refundedAt;
        return $this;
    }
    /**
     * When the store revoked the purchase; null unless it did.
     *
     * @return string|null
     */
    public function getRevokedAt(): ?string
    {
        return $this->revokedAt;
    }
    /**
     * When the store revoked the purchase; null unless it did.
     *
     * @param string|null $revokedAt
     *
     * @return self
     */
    public function setRevokedAt(?string $revokedAt): self
    {
        $this->initialized['revokedAt'] = true;
        $this->revokedAt = $revokedAt;
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