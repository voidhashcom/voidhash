<?php

namespace Voidhash\Generated\Core\Model;

class PaymentProviderProductMappingJsonEncoding
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
     * The payment provider that sells the store product.
     *
     * @var string
     */
    protected $paymentProviderId;
    /**
     * The product the store product is mapped to.
     *
     * @var string
     */
    protected $productId;
    /**
     * The store's id for the product, as the provider's catalog lists it.
     *
     * @var string
     */
    protected $providerProductKey;
    /**
     * Whether purchases of the store product resolve to this product; a store product is active for at most one product.
     *
     * @var bool
     */
    protected $isActive;
    /**
     * Whether the product is sold as this store product on this provider: the one apps are offered and paywalls list. A product is sold as one of its active store products per provider and environment; its other active ones only recognize purchases made under them.
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
     * The store-specific settings of the mapping, such as the store product and its offers.
     *
     * @var array<string, mixed>
     */
    protected $configuration;
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
     * The payment provider that sells the store product.
     *
     * @return string
     */
    public function getPaymentProviderId(): string
    {
        return $this->paymentProviderId;
    }
    /**
     * The payment provider that sells the store product.
     *
     * @param string $paymentProviderId
     *
     * @return self
     */
    public function setPaymentProviderId(string $paymentProviderId): self
    {
        $this->initialized['paymentProviderId'] = true;
        $this->paymentProviderId = $paymentProviderId;
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
     * The store's id for the product, as the provider's catalog lists it.
     *
     * @return string
     */
    public function getProviderProductKey(): string
    {
        return $this->providerProductKey;
    }
    /**
     * The store's id for the product, as the provider's catalog lists it.
     *
     * @param string $providerProductKey
     *
     * @return self
     */
    public function setProviderProductKey(string $providerProductKey): self
    {
        $this->initialized['providerProductKey'] = true;
        $this->providerProductKey = $providerProductKey;
        return $this;
    }
    /**
     * Whether purchases of the store product resolve to this product; a store product is active for at most one product.
     *
     * @return bool
     */
    public function getIsActive(): bool
    {
        return $this->isActive;
    }
    /**
     * Whether purchases of the store product resolve to this product; a store product is active for at most one product.
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
     * Whether the product is sold as this store product on this provider: the one apps are offered and paywalls list. A product is sold as one of its active store products per provider and environment; its other active ones only recognize purchases made under them.
     *
     * @return bool
     */
    public function getIsSold(): bool
    {
        return $this->isSold;
    }
    /**
     * Whether the product is sold as this store product on this provider: the one apps are offered and paywalls list. A product is sold as one of its active store products per provider and environment; its other active ones only recognize purchases made under them.
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
    /**
     * The store-specific settings of the mapping, such as the store product and its offers.
     *
     * @return array<string, mixed>
     */
    public function getConfiguration(): iterable
    {
        return $this->configuration;
    }
    /**
     * The store-specific settings of the mapping, such as the store product and its offers.
     *
     * @param array<string, mixed> $configuration
     *
     * @return self
     */
    public function setConfiguration(iterable $configuration): self
    {
        $this->initialized['configuration'] = true;
        $this->configuration = $configuration;
        return $this;
    }
}