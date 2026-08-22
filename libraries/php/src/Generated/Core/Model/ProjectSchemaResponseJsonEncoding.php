<?php

namespace Voidhash\Generated\Core\Model;

class ProjectSchemaResponseJsonEncoding
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
     * @var list<string>
     */
    protected $enabledProviders;
    /**
     * @var list<SchemaLocationJsonEncoding>
     */
    protected $locations;
    /**
     * @var list<SchemaPerkJsonEncoding>
     */
    protected $perks;
    /**
     * @var list<SchemaProductJsonEncoding>
     */
    protected $products;
    /**
     * @var string
     */
    protected $version;
    /**
     * @return list<string>
     */
    public function getEnabledProviders(): array
    {
        return $this->enabledProviders;
    }
    /**
     * @param list<string> $enabledProviders
     *
     * @return self
     */
    public function setEnabledProviders(array $enabledProviders): self
    {
        $this->initialized['enabledProviders'] = true;
        $this->enabledProviders = $enabledProviders;
        return $this;
    }
    /**
     * @return list<SchemaLocationJsonEncoding>
     */
    public function getLocations(): array
    {
        return $this->locations;
    }
    /**
     * @param list<SchemaLocationJsonEncoding> $locations
     *
     * @return self
     */
    public function setLocations(array $locations): self
    {
        $this->initialized['locations'] = true;
        $this->locations = $locations;
        return $this;
    }
    /**
     * @return list<SchemaPerkJsonEncoding>
     */
    public function getPerks(): array
    {
        return $this->perks;
    }
    /**
     * @param list<SchemaPerkJsonEncoding> $perks
     *
     * @return self
     */
    public function setPerks(array $perks): self
    {
        $this->initialized['perks'] = true;
        $this->perks = $perks;
        return $this;
    }
    /**
     * @return list<SchemaProductJsonEncoding>
     */
    public function getProducts(): array
    {
        return $this->products;
    }
    /**
     * @param list<SchemaProductJsonEncoding> $products
     *
     * @return self
     */
    public function setProducts(array $products): self
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