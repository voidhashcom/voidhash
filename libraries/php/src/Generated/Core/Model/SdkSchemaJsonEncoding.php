<?php

namespace Voidhash\Generated\Core\Model;

class SdkSchemaJsonEncoding
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
     * @var array<string, SdkSchemaLocationJsonEncoding>
     */
    protected $locations;
    /**
     * @var array<string, SdkSchemaPerkJsonEncoding>
     */
    protected $perks;
    /**
     * @var array<string, SdkSchemaProductJsonEncoding>
     */
    protected $products;
    /**
     * @var string
     */
    protected $version;
    /**
     * @return array<string, SdkSchemaLocationJsonEncoding>
     */
    public function getLocations(): iterable
    {
        return $this->locations;
    }
    /**
     * @param array<string, SdkSchemaLocationJsonEncoding> $locations
     *
     * @return self
     */
    public function setLocations(iterable $locations): self
    {
        $this->initialized['locations'] = true;
        $this->locations = $locations;
        return $this;
    }
    /**
     * @return array<string, SdkSchemaPerkJsonEncoding>
     */
    public function getPerks(): iterable
    {
        return $this->perks;
    }
    /**
     * @param array<string, SdkSchemaPerkJsonEncoding> $perks
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
     * @return array<string, SdkSchemaProductJsonEncoding>
     */
    public function getProducts(): iterable
    {
        return $this->products;
    }
    /**
     * @param array<string, SdkSchemaProductJsonEncoding> $products
     *
     * @return self
     */
    public function setProducts(iterable $products): self
    {
        $this->initialized['products'] = true;
        $this->products = $products;
        return $this;
    }
    /**
     * @return string
     */
    public function getVersion(): string
    {
        return $this->version;
    }
    /**
     * @param string $version
     *
     * @return self
     */
    public function setVersion(string $version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
}