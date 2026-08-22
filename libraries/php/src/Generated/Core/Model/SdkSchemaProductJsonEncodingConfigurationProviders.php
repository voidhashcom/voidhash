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
     * @var array<string, mixed>
     */
    protected $appleAppStore;
    /**
     * @var SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment
     */
    protected $development;
    /**
     * @var array<string, mixed>
     */
    protected $googlePlay;
    /**
     * @return array<string, mixed>
     */
    public function getAppleAppStore(): iterable
    {
        return $this->appleAppStore;
    }
    /**
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
     * @return SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment
     */
    public function getDevelopment(): SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment
    {
        return $this->development;
    }
    /**
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
     * @return array<string, mixed>
     */
    public function getGooglePlay(): iterable
    {
        return $this->googlePlay;
    }
    /**
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