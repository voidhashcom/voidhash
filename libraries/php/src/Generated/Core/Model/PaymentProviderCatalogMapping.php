<?php

namespace Voidhash\Generated\Core\Model;

class PaymentProviderCatalogMapping
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
     * The mapping's id, `pp_prod_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The product the store product is mapped to.
     *
     * @var string
     */
    protected $productId;
    /**
     * Whether purchases of the store product resolve to this product.
     *
     * @var bool
     */
    protected $isActive;
    /**
     * Whether the product is sold as this store product on this provider.
     *
     * @var bool
     */
    protected $isSold;
    /**
     * Which purchases a store product key names: `production`, `test`, or `all` when every environment uses the same key. App Store and Google Play mappings are always `all`; a Stripe price's is read from Stripe.
     *
     * @var string
     */
    protected $environment;
    /**
     * The mapping's id, `pp_prod_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The mapping's id, `pp_prod_...`.
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
     * The product the store product is mapped to.
     *
     * @return string
     */
    public function getProductId(): string
    {
        return $this->productId;
    }
    /**
     * The product the store product is mapped to.
     *
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
     * Whether purchases of the store product resolve to this product.
     *
     * @return bool
     */
    public function getIsActive(): bool
    {
        return $this->isActive;
    }
    /**
     * Whether purchases of the store product resolve to this product.
     *
     * @param bool $isActive
     *
     * @return self
     */
    public function setIsActive(bool $isActive): self
    {
        $this->initialized['isActive'] = true;
        $this->isActive = $isActive;
        return $this;
    }
    /**
     * Whether the product is sold as this store product on this provider.
     *
     * @return bool
     */
    public function getIsSold(): bool
    {
        return $this->isSold;
    }
    /**
     * Whether the product is sold as this store product on this provider.
     *
     * @param bool $isSold
     *
     * @return self
     */
    public function setIsSold(bool $isSold): self
    {
        $this->initialized['isSold'] = true;
        $this->isSold = $isSold;
        return $this;
    }
    /**
     * Which purchases a store product key names: `production`, `test`, or `all` when every environment uses the same key. App Store and Google Play mappings are always `all`; a Stripe price's is read from Stripe.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * Which purchases a store product key names: `production`, `test`, or `all` when every environment uses the same key. App Store and Google Play mappings are always `all`; a Stripe price's is read from Stripe.
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