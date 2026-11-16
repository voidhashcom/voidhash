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
     * An id the SDK gives the simulated purchase; sending the same id again records it only once.
     *
     * @var string
     */
    protected $devTransactionId;
    /**
     * The slug of the product bought.
     *
     * @var string
     */
    protected $productSlug;
    /**
     * When the purchase was made, in milliseconds since the Unix epoch.
     *
     * @var mixed
     */
    protected $purchaseDate;
    /**
     * How many units were bought, a positive whole number; more than 1 only for consumable products. Defaults to 1.
     *
     * @var mixed|null
     */
    protected $quantity;
    /**
     * An id the SDK gives the simulated purchase; sending the same id again records it only once.
     *
     * @return string
     */
    public function getDevTransactionId(): string
    {
        return $this->devTransactionId;
    }
    /**
     * An id the SDK gives the simulated purchase; sending the same id again records it only once.
     *
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
     * The slug of the product bought.
     *
     * @return string
     */
    public function getProductSlug(): string
    {
        return $this->productSlug;
    }
    /**
     * The slug of the product bought.
     *
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
     * When the purchase was made, in milliseconds since the Unix epoch.
     *
     * @return mixed
     */
    public function getPurchaseDate()
    {
        return $this->purchaseDate;
    }
    /**
     * When the purchase was made, in milliseconds since the Unix epoch.
     *
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
     * How many units were bought, a positive whole number; more than 1 only for consumable products. Defaults to 1.
     *
     * @return mixed
     */
    public function getQuantity()
    {
        return $this->quantity;
    }
    /**
     * How many units were bought, a positive whole number; more than 1 only for consumable products. Defaults to 1.
     *
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