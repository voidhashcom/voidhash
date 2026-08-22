<?php

namespace Voidhash\Generated\Core\Model;

class SdkPurchaseHistoryEntryJsonEncoding
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
     * @var string
     */
    protected $createdAt;
    /**
     * @var string|null
     */
    protected $productId;
    /**
     * @var string
     */
    protected $providerKey;
    /**
     * @var string
     */
    protected $purchaseId;
    /**
     * @var string
     */
    protected $sourcePersonId;
    /**
     * @var string
     */
    protected $type;
    /**
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getProductId(): ?string
    {
        return $this->productId;
    }
    /**
     * @param string|null $productId
     *
     * @return self
     */
    public function setProductId(?string $productId): self
    {
        $this->initialized['productId'] = true;
        $this->productId = $productId;
        return $this;
    }
    /**
     * @return string
     */
    public function getProviderKey(): string
    {
        return $this->providerKey;
    }
    /**
     * @param string $providerKey
     *
     * @return self
     */
    public function setProviderKey(string $providerKey): self
    {
        $this->initialized['providerKey'] = true;
        $this->providerKey = $providerKey;
        return $this;
    }
    /**
     * @return string
     */
    public function getPurchaseId(): string
    {
        return $this->purchaseId;
    }
    /**
     * @param string $purchaseId
     *
     * @return self
     */
    public function setPurchaseId(string $purchaseId): self
    {
        $this->initialized['purchaseId'] = true;
        $this->purchaseId = $purchaseId;
        return $this;
    }
    /**
     * @return string
     */
    public function getSourcePersonId(): string
    {
        return $this->sourcePersonId;
    }
    /**
     * @param string $sourcePersonId
     *
     * @return self
     */
    public function setSourcePersonId(string $sourcePersonId): self
    {
        $this->initialized['sourcePersonId'] = true;
        $this->sourcePersonId = $sourcePersonId;
        return $this;
    }
    /**
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
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
}