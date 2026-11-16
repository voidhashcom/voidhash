<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlExplainResultJsonEncodingColumnsItem
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
     * The column's VoidQL type.
     *
     * @var string
     */
    protected $type;
    /**
     * Whether the database says the column can read NULL.
     *
     * @var bool
     */
    protected $isNullable;
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
     * The column's VoidQL type.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * The column's VoidQL type.
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
    /**
     * Whether the database says the column can read NULL.
     *
     * @return bool
     */
    public function getIsNullable(): bool
    {
        return $this->isNullable;
    }
    /**
     * Whether the database says the column can read NULL.
     *
     * @param bool $isNullable
     *
     * @return self
     */
    public function setIsNullable(bool $isNullable): self
    {
        $this->initialized['isNullable'] = true;
        $this->isNullable = $isNullable;
        return $this;
    }
}