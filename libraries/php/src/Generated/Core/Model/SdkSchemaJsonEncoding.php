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
     * The project's paywall locations, keyed by slug.
     *
     * @var array<string, SdkSchemaLocationJsonEncoding>
     */
    protected $locations;
    /**
     * The project's perks, keyed by slug.
     *
     * @var array<string, SdkSchemaPerkJsonEncoding>
     */
    protected $perks;
    /**
     * The project's products, keyed by slug.
     *
     * @var array<string, SdkSchemaProductJsonEncoding>
     */
    protected $products;
    /**
     * The schema's version, `sha256:<hex>`, which changes whenever code generated from the schema would: its perks, products, store mappings, locations or native component contracts. Enabling a store or another paywall using a component leaves it as it is.
     *
     * @var string
     */
    protected $version;
    /**
     * The project's paywall locations, keyed by slug.
     *
     * @return array<string, SdkSchemaLocationJsonEncoding>
     */
    public function getLocations(): iterable
    {
        return $this->locations;
    }
    /**
     * The project's paywall locations, keyed by slug.
     *
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
     * The project's perks, keyed by slug.
     *
     * @return array<string, SdkSchemaPerkJsonEncoding>
     */
    public function getPerks(): iterable
    {
        return $this->perks;
    }
    /**
     * The project's perks, keyed by slug.
     *
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
     * The project's products, keyed by slug.
     *
     * @return array<string, SdkSchemaProductJsonEncoding>
     */
    public function getProducts(): iterable
    {
        return $this->products;
    }
    /**
     * The project's products, keyed by slug.
     *
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
     * The schema's version, `sha256:<hex>`, which changes whenever code generated from the schema would: its perks, products, store mappings, locations or native component contracts. Enabling a store or another paywall using a component leaves it as it is.
     *
     * @return string
     */
    public function getVersion(): string
    {
        return $this->version;
    }
    /**
     * The schema's version, `sha256:<hex>`, which changes whenever code generated from the schema would: its perks, products, store mappings, locations or native component contracts. Enabling a store or another paywall using a component leaves it as it is.
     *
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