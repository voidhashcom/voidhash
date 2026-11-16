<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlQueryResultJsonEncodingColumnsItem
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
     * The column's name, as the query names it.
     *
     * @var string
     */
    protected $name;
    /**
     * The column's VoidQL type, such as `String`, `Int64` or `DateTime`.
     *
     * @var string
     */
    protected $type;
    /**
     * The column's name, as the query names it.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The column's name, as the query names it.
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
    /**
     * The column's VoidQL type, such as `String`, `Int64` or `DateTime`.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * The column's VoidQL type, such as `String`, `Int64` or `DateTime`.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
}