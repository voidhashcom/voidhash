<?php

namespace Voidhash\Generated\Core\Model;

class CreatePaymentProviderProductMappingBodyJsonEncoding
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
     * The product to map the store product to.
     *
     * @var string
     */
    protected $productId;
    /**
     * Names the store product, as the `configuration` of its catalog entry does, with any store-specific settings such as offers.
     *
     * @var array<string, mixed>
     */
    protected $configuration;
    /**
     * Which purchases a store product key names: `production`, `test`, or `all` when every environment uses the same key. App Store and Google Play mappings are always `all`; a Stripe price's is read from Stripe.
     *
     * @var string
     */
    protected $environment;
    /**
     * `true` moves a store product active for another product to this one, deactivating that mapping; otherwise mapping it is refused. Defaults to `false`.
     *
     * @var bool|null
     */
    protected $isReassignment;
    /**
     * The product to map the store product to.
     *
     * @return string
     */
    public function getProductId(): string
    {
        return $this->productId;
    }
    /**
     * The product to map the store product to.
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
     * Names the store product, as the `configuration` of its catalog entry does, with any store-specific settings such as offers.
     *
     * @return array<string, mixed>
     */
    public function getConfiguration(): iterable
    {
        return $this->configuration;
    }
    /**
     * Names the store product, as the `configuration` of its catalog entry does, with any store-specific settings such as offers.
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
     * `true` moves a store product active for another product to this one, deactivating that mapping; otherwise mapping it is refused. Defaults to `false`.
     *
     * @return bool|null
     */
    public function getIsReassignment(): ?bool
    {
        return $this->isReassignment;
    }
    /**
     * `true` moves a store product active for another product to this one, deactivating that mapping; otherwise mapping it is refused. Defaults to `false`.
     *
     * @param bool|null $isReassignment
     *
     * @return self
     */
    public function setIsReassignment(?bool $isReassignment): self
    {
        $this->initialized['isReassignment'] = true;
        $this->isReassignment = $isReassignment;
        return $this;
    }
}