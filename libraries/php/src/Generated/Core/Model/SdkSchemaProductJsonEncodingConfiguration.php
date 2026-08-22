<?php

namespace Voidhash\Generated\Core\Model;

class SdkSchemaProductJsonEncodingConfiguration
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
     * @var array<string, bool>
     */
    protected $perks;
    /**
     * @var SdkSchemaProductJsonEncodingConfigurationProviders
     */
    protected $providers;
    /**
     * @return array<string, bool>
     */
    public function getPerks(): iterable
    {
        return $this->perks;
    }
    /**
     * @param array<string, bool> $perks
     *
     * @return self
     */
    public function setPerks(iterable $perks): self
    {
        $this->initialized['perks'] = true;
        $this->perks = $perks;
        return $this;
    }
    /**
     * @return SdkSchemaProductJsonEncodingConfigurationProviders
     */
    public function getProviders(): SdkSchemaProductJsonEncodingConfigurationProviders
    {
        return $this->providers;
    }
    /**
     * @param SdkSchemaProductJsonEncodingConfigurationProviders $providers
     *
     * @return self
     */
    public function setProviders(SdkSchemaProductJsonEncodingConfigurationProviders $providers): self
    {
        $this->initialized['providers'] = true;
        $this->providers = $providers;
        return $this;
    }
}