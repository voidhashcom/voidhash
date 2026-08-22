<?php

namespace Voidhash\Generated\Core\Model;

class ApiV1SdkSyncTransactionPostBody
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
    protected $appAccountToken;
    /**
     * @var string
     */
    protected $platform;
    /**
     * @var string|null
     */
    protected $providerProductId;
    /**
     * @var string
     */
    protected $productSlug;
    /**
     * @var mixed
     */
    protected $purchaseDate;
    /**
     * @var string|null
     */
    protected $purchaseToken;
    /**
     * @var mixed
     */
    protected $quantity;
    /**
     * @var string|null
     */
    protected $receipt;
    /**
     * @var string
     */
    protected $transactionId;
    /**
     * @return string|null
     */
    public function getAppAccountToken(): ?string
    {
        return $this->appAccountToken;
    }
    /**
     * @param string|null $appAccountToken
     *
     * @return self
     */
    public function setAppAccountToken(?string $appAccountToken): self
    {
        $this->initialized['appAccountToken'] = true;
        $this->appAccountToken = $appAccountToken;
        return $this;
    }
    /**
     * @return string
     */
    public function getPlatform(): string
    {
        return $this->platform;
    }
    /**
     * @param string $platform
     *
     * @return self
     */
    public function setPlatform(string $platform): self
    {
        $this->initialized['platform'] = true;
        $this->platform = $platform;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getProviderProductId(): ?string
    {
        return $this->providerProductId;
    }
    /**
     * @param string|null $providerProductId
     *
     * @return self
     */
    public function setProviderProductId(?string $providerProductId): self
    {
        $this->initialized['providerProductId'] = true;
        $this->providerProductId = $providerProductId;
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
     * @return mixed
     */
    public function getPurchaseDate()
    {
        return $this->purchaseDate;
    }
    /**
     * @param mixed $purchaseDate
     *
     * @return self
     */
    public function setPurchaseDate($purchaseDate): self
    {
        $this->initialized['purchaseDate'] = true;
        $this->purchaseDate = $purchaseDate;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getPurchaseToken(): ?string
    {
        return $this->purchaseToken;
    }
    /**
     * @param string|null $purchaseToken
     *
     * @return self
     */
    public function setPurchaseToken(?string $purchaseToken): self
    {
        $this->initialized['purchaseToken'] = true;
        $this->purchaseToken = $purchaseToken;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getQuantity()
    {
        return $this->quantity;
    }
    /**
     * @param mixed $quantity
     *
     * @return self
     */
    public function setQuantity($quantity): self
    {
        $this->initialized['quantity'] = true;
        $this->quantity = $quantity;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getReceipt(): ?string
    {
        return $this->receipt;
    }
    /**
     * @param string|null $receipt
     *
     * @return self
     */
    public function setReceipt(?string $receipt): self
    {
        $this->initialized['receipt'] = true;
        $this->receipt = $receipt;
        return $this;
    }
    /**
     * @return string
     */
    public function getTransactionId(): string
    {
        return $this->transactionId;
    }
    /**
     * @param string $transactionId
     *
     * @return self
     */
    public function setTransactionId(string $transactionId): self
    {
        $this->initialized['transactionId'] = true;
        $this->transactionId = $transactionId;
        return $this;
    }
}