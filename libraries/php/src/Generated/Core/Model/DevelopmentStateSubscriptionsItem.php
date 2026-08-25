<?php

namespace Voidhash\Generated\Core\Model;

class DevelopmentStateSubscriptionsItem
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
     * @var string|null
     */
    protected $canceledAt;
    /**
     * @var string|null
     */
    protected $expiresAt;
    /**
     * @var string|null
     */
    protected $gracePeriodExpiresAt;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var string
     */
    protected $productId;
    /**
     * @var string
     */
    protected $productName;
    /**
     * @var string
     */
    protected $productSlug;
    /**
     * @var string
     */
    protected $startsAt;
    /**
     * @var mixed
     */
    protected $status;
    /**
     * @return string|null
     */
    public function getCanceledAt(): ?string
    {
        return $this->canceledAt;
    }
    /**
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
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
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
     * @return string|null
     */
    public function getGracePeriodExpiresAt(): ?string
    {
        return $this->gracePeriodExpiresAt;
    }
    /**
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
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
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
     * @return string
     */
    public function getProductId(): string
    {
        return $this->productId;
    }
    /**
     * @param string $productId
     *
     * @return self
     */
    public function setProductId(string $productId): self
    {
        $this->initialized['productId'] = true;
        $this->productId = $productId;
        return $this;
    }
    /**
     * @return string
     */
    public function getProductName(): string
    {
        return $this->productName;
    }
    /**
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
     * @return string
     */
    public function getProductSlug(): string
    {
        return $this->productSlug;
    }
    /**
     * @param string $productSlug
     *
     * @return self
     */
    public function setProductSlug(string $productSlug): self
    {
        $this->initialized['productSlug'] = true;
        $this->productSlug = $productSlug;
        return $this;
    }
    /**
     * @return string
     */
    public function getStartsAt(): string
    {
        return $this->startsAt;
    }
    /**
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
     * @return mixed
     */
    public function getStatus()
    {
        return $this->status;
    }
    /**
     * @param mixed $status
     *
     * @return self
     */
    public function setStatus($status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
}