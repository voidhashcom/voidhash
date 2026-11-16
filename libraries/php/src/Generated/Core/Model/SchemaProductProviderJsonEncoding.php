<?php

namespace Voidhash\Generated\Core\Model;

class SchemaProductProviderJsonEncoding
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
     * How the product is sold in the store, with store-specific keys such as `productId` or `basePlanId`.
     *
     * @var array<string, mixed>
     */
    protected $configuration;
    /**
     * A store: `appleAppStore` (the App Store) or `googlePlay` (Google Play).
     *
     * @var string
     */
    protected $providerId;
    /**
     * How the product is sold in the store, with store-specific keys such as `productId` or `basePlanId`.
     *
     * @return array<string, mixed>
     */
    public function getConfiguration(): iterable
    {
        return $this->configuration;
    }
    /**
     * How the product is sold in the store, with store-specific keys such as `productId` or `basePlanId`.
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
     * A store: `appleAppStore` (the App Store) or `googlePlay` (Google Play).
     *
     * @return string
     */
    public function getProviderId(): string
    {
        return $this->providerId;
    }
    /**
     * A store: `appleAppStore` (the App Store) or `googlePlay` (Google Play).
     *
     * @param string $providerId
     *
     * @return self
     */
    public function setProviderId(string $providerId): self
    {
        $this->initialized['providerId'] = true;
        $this->providerId = $providerId;
        return $this;
    }
}