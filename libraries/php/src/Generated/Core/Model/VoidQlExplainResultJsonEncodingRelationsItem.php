<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlExplainResultJsonEncodingRelationsItem
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
     * The relation's name.
     *
     * @var string
     */
    protected $name;
    /**
     * How many times the query reads it.
     *
     * @var int
     */
    protected $reads;
    /**
     * The relation's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The relation's name.
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
     * How many times the query reads it.
     *
     * @return int
     */
    public function getReads(): int
    {
        return $this->reads;
    }
    /**
     * How many times the query reads it.
     *
     * @param int $reads
     *
     * @return self
     */
    public function setReads(int $reads): self
    {
        $this->initialized['reads'] = true;
        $this->reads = $reads;
        return $this;
    }
}