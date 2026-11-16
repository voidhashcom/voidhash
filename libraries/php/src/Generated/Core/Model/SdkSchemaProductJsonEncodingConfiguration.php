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
     * The perks the product unlocks, as an object whose keys are their slugs.
     *
     * @var array<string, bool>
     */
    protected $perks;
    /**
     * How the product is sold, by store.
     *
     * @var SdkSchemaProductJsonEncodingConfigurationProviders
     */
    protected $providers;
    /**
     * The perks the product unlocks, as an object whose keys are their slugs.
     *
     * @return array<string, bool>
     */
    public function getPerks(): iterable
    {
        return $this->perks;
    }
    /**
     * The perks the product unlocks, as an object whose keys are their slugs.
     *
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
     * How the product is sold, by store.
     *
     * @return SdkSchemaProductJsonEncodingConfigurationProviders
     */
    public function getProviders(): SdkSchemaProductJsonEncodingConfigurationProviders
    {
        return $this->providers;
    }
    /**
     * How the product is sold, by store.
     *
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