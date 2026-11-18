<?php

namespace Voidhash\Generated\Core\Model;

class SchemaVersionJsonEncoding
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
     * The schema's version, `sha256:<hex>`, which changes whenever code generated from the schema would: its perks, products, store mappings, locations or native component contracts. Enabling a store or another paywall using a component leaves it as it is. Also the `ETag` of the response.
     *
     * @var string
     */
    protected $version;
    /**
     * The schema's version, `sha256:<hex>`, which changes whenever code generated from the schema would: its perks, products, store mappings, locations or native component contracts. Enabling a store or another paywall using a component leaves it as it is. Also the `ETag` of the response.
     *
     * @return string
     */
    public function getVersion(): string
    {
        return $this->version;
    }
    /**
     * The schema's version, `sha256:<hex>`, which changes whenever code generated from the schema would: its perks, products, store mappings, locations or native component contracts. Enabling a store or another paywall using a component leaves it as it is. Also the `ETag` of the response.
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