<?php

namespace Voidhash\Generated\Core\Model;

class SdkSchemaProductJsonEncodingProperties
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
     * The product's display name.
     *
     * @var string
     */
    protected $name;
    /**
     * The product's display name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The product's display name.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
}