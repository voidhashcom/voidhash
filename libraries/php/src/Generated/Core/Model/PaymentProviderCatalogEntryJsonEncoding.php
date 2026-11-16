<?php

namespace Voidhash\Generated\Core\Model;

class PaymentProviderCatalogEntryJsonEncoding
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
     * The store's id for the product, such as an App Store product id or a Stripe price id.
     *
     * @var string
     */
    protected $providerProductKey;
    /**
     * The store's name for the product; its key once the store no longer lists it.
     *
     * @var string
     */
    protected $name;
    /**
     * The `configuration` a mapping of this store product takes.
     *
     * @var array<string, mixed>
     */
    protected $configuration;
    /**
     * The store product's mappings to products; empty when it is unmapped.
     *
     * @var list<PaymentProviderCatalogMapping>
     */
    protected $mappings;
    /**
     * The store's id for the product, such as an App Store product id or a Stripe price id.
     *
     * @return string
     */
    public function getProviderProductKey(): string
    {
        return $this->providerProductKey;
    }
    /**
     * The store's id for the product, such as an App Store product id or a Stripe price id.
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
     * The store's name for the product; its key once the store no longer lists it.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The store's name for the product; its key once the store no longer lists it.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The `configuration` a mapping of this store product takes.
     *
     * @return array<string, mixed>
     */
    public function getConfiguration(): iterable
    {
        return $this->configuration;
    }
    /**
     * The `configuration` a mapping of this store product takes.
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
     * The store product's mappings to products; empty when it is unmapped.
     *
     * @return list<PaymentProviderCatalogMapping>
     */
    public function getMappings(): array
    {
        return $this->mappings;
    }
    /**
     * The store product's mappings to products; empty when it is unmapped.
     *
     * @param list<PaymentProviderCatalogMapping> $mappings
     *
     * @return self
     */
    public function setMappings(array $mappings): self
    {
        $this->initialized['mappings'] = true;
        $this->mappings = $mappings;
        return $this;
    }
}