<?php

namespace Voidhash\Generated\Core\Model;

class SchemaNativePropJsonEncoding
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
     * @var mixed
     */
    protected $default;
    /**
     * The property's key, the camel case of its name in the designer.
     *
     * @var string
     */
    protected $key;
    /**
     * Whether the view can write the property; false for a computed one.
     *
     * @var bool
     */
    protected $isWritable;
    /**
     * The type of a value a native view exchanges with the flow.
     *
     * @var SchemaNativeValueType|SchemaNativeEnumType|SchemaNativeListType
     */
    protected $type;
    /**
     * @return mixed
     */
    public function getDefault()
    {
        return $this->default;
    }
    /**
     * @param mixed $default
     *
     * @return self
     */
    public function setDefault($default): self
    {
        $this->initialized['default'] = true;
        $this->default = $default;
        return $this;
    }
    /**
     * The property's key, the camel case of its name in the designer.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The property's key, the camel case of its name in the designer.
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
     * Whether the view can write the property; false for a computed one.
     *
     * @return bool
     */
    public function getIsWritable(): bool
    {
        return $this->isWritable;
    }
    /**
     * Whether the view can write the property; false for a computed one.
     *
     * @param bool $isWritable
     *
     * @return self
     */
    public function setIsWritable(bool $isWritable): self
    {
        $this->initialized['isWritable'] = true;
        $this->isWritable = $isWritable;
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