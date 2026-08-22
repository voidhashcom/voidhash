<?php

namespace Voidhash\Generated\Core\Model;

class SdkDevelopmentPurchaseBodyJsonEncoding
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
    protected $devTransactionId;
    /**
     * @var string
     */
    protected $productSlug;
    /**
     * @var mixed
     */
    protected $purchaseDate;
    /**
     * @var mixed|null
     */
    protected $quantity;
    /**
     * @return string
     */
    public function getDevTransactionId(): string
    {
        return $this->devTransactionId;
    }
    /**
     * @param string $devTransactionId
     *
     * @return self
     */
    public function setDevTransactionId(string $devTransactionId): self
    {
        $this->initialized['devTransactionId'] = true;
        $this->devTransactionId = $devTransactionId;
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
}