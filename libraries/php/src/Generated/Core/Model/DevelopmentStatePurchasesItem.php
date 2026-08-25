<?php

namespace Voidhash\Generated\Core\Model;

class DevelopmentStatePurchasesItem
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
    protected $createdAt;
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
     * @var string|null
     */
    protected $refundedAt;
    /**
     * @var string|null
     */
    protected $revokedAt;
    /**
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
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
     * @return string|null
     */
    public function getRefundedAt(): ?string
    {
        return $this->refundedAt;
    }
    /**
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
     * @return string|null
     */
    public function getRevokedAt(): ?string
    {
        return $this->revokedAt;
    }
    /**
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
}