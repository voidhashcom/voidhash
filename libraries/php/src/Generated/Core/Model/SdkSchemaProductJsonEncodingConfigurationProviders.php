<?php

namespace Voidhash\Generated\Core\Model;

class SdkSchemaProductJsonEncodingConfigurationProviders
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
    protected $appleAppStore;
    /**
     * The fixed price and billing period debug builds use for simulated development purchases.
     *
     * @var SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment
     */
    protected $development;
    /**
     * How the product is sold in the store, with store-specific keys such as `productId` or `basePlanId`.
     *
     * @var array<string, mixed>
     */
    protected $googlePlay;
    /**
     * How the product is sold in the store, with store-specific keys such as `productId` or `basePlanId`.
     *
     * @return array<string, mixed>
     */
    public function getAppleAppStore(): iterable
    {
        return $this->appleAppStore;
    }
    /**
     * How the product is sold in the store, with store-specific keys such as `productId` or `basePlanId`.
     *
     * @param array<string, mixed> $appleAppStore
     *
     * @return self
     */
    public function setAppleAppStore(iterable $appleAppStore): self
    {
        $this->initialized['appleAppStore'] = true;
        $this->appleAppStore = $appleAppStore;
        return $this;
    }
    /**
     * The fixed price and billing period debug builds use for simulated development purchases.
     *
     * @return SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment
     */
    public function getDevelopment(): SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment
    {
        return $this->development;
    }
    /**
     * The fixed price and billing period debug builds use for simulated development purchases.
     *
     * @param SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment $development
     *
     * @return self
     */
    public function setDevelopment(SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment $development): self
    {
        $this->initialized['development'] = true;
        $this->development = $development;
        return $this;
    }
    /**
     * How the product is sold in the store, with store-specific keys such as `productId` or `basePlanId`.
     *
     * @return array<string, mixed>
     */
    public function getGooglePlay(): iterable
    {
        return $this->googlePlay;
    }
    /**
     * How the product is sold in the store, with store-specific keys such as `productId` or `basePlanId`.
     *
     * @param array<string, mixed> $googlePlay
     *
     * @return self
     */
    public function setGooglePlay(iterable $googlePlay): self
    {
        $this->initialized['googlePlay'] = true;
        $this->googlePlay = $googlePlay;
        return $this;
    }
}