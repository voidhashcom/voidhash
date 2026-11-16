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
     * The stores the project sells in.
     *
     * @var list<string>
     */
    protected $enabledProviders;
    /**
     * The project's paywall locations.
     *
     * @var list<SchemaLocationJsonEncoding>
     */
    protected $locations;
    /**
     * The project's perks.
     *
     * @var list<SchemaPerkJsonEncoding>
     */
    protected $perks;
    /**
     * The project's products.
     *
     * @var list<SchemaProductJsonEncoding>
     */
    protected $products;
    /**
     * The schema's version, `sha256:<hex>`, which changes whenever the schema does; also the `ETag` of the response.
     *
     * @var string
     */
    protected $version;
    /**
     * The stores the project sells in.
     *
     * @return list<string>
     */
    public function getEnabledProviders(): array
    {
        return $this->enabledProviders;
    }
    /**
     * The stores the project sells in.
     *
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
     * The project's paywall locations.
     *
     * @return list<SchemaLocationJsonEncoding>
     */
    public function getLocations(): array
    {
        return $this->locations;
    }
    /**
     * The project's paywall locations.
     *
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
     * The project's perks.
     *
     * @return list<SchemaPerkJsonEncoding>
     */
    public function getPerks(): array
    {
        return $this->perks;
    }
    /**
     * The project's perks.
     *
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
     * The project's products.
     *
     * @return list<SchemaProductJsonEncoding>
     */
    public function getProducts(): array
    {
        return $this->products;
    }
    /**
     * The project's products.
     *
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
     * The schema's version, `sha256:<hex>`, which changes whenever the schema does; also the `ETag` of the response.
     *
     * @return string
     */
    public function getVersion(): string
    {
        return $this->version;
    }
    /**
     * The schema's version, `sha256:<hex>`, which changes whenever the schema does; also the `ETag` of the response.
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