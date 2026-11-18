<?php

namespace Voidhash\Generated\Core\Model;

class SchemaNativePayloadFieldJsonEncoding
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
     * The field's key.
     *
     * @var string
     */
    protected $key;
    /**
     * The type of a value a native view exchanges with the flow.
     *
     * @var SchemaNativeValueType|SchemaNativeEnumType|SchemaNativeListType
     */
    protected $type;
    /**
     * The field's key.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The field's key.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * The type of a value a native view exchanges with the flow.
     *
     * @return SchemaNativeValueType|SchemaNativeEnumType|SchemaNativeListType
     */
    public function getType()
    {
        return $this->type;
    }
    /**
     * The type of a value a native view exchanges with the flow.
     *
     * @param SchemaNativeValueType|SchemaNativeEnumType|SchemaNativeListType $type
     *
     * @return self
     */
    public function setType($type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
}