<?php

namespace Voidhash\Generated\Core\Model;

class SchemaNativeValueType
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
     * `string`, `number`, `boolean`, or `product`: a product's id when written, the product's details when read.
     *
     * @var string
     */
    protected $kind;
    /**
     * `string`, `number`, `boolean`, or `product`: a product's id when written, the product's details when read.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * `string`, `number`, `boolean`, or `product`: a product's id when written, the product's details when read.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
}