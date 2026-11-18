<?php

namespace Voidhash\Generated\Core\Model;

class SchemaNativeListType
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
     * Always `list`.
     *
     * @var string
     */
    protected $kind;
    /**
     * The type of the list's items, which is not a list.
     *
     * @var SchemaNativeValueType|SchemaNativeEnumType
     */
    protected $of;
    /**
     * Always `list`.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * Always `list`.
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
    /**
     * The type of the list's items, which is not a list.
     *
     * @return SchemaNativeValueType|SchemaNativeEnumType
     */
    public function getOf()
    {
        return $this->of;
    }
    /**
     * The type of the list's items, which is not a list.
     *
     * @param SchemaNativeValueType|SchemaNativeEnumType $of
     *
     * @return self
     */
    public function setOf($of): self
    {
        $this->initialized['of'] = true;
        $this->of = $of;
        return $this;
    }
}