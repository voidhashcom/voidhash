<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCohortEventCount
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
     * `gte` at least, `lte` at most, or `eq` exactly `value` times.
     *
     * @var string
     */
    protected $op;
    /**
     * The count compared with, from 1 to 1000000.
     *
     * @var int
     */
    protected $value;
    /**
     * `gte` at least, `lte` at most, or `eq` exactly `value` times.
     *
     * @return string
     */
    public function getOp(): string
    {
        return $this->op;
    }
    /**
     * `gte` at least, `lte` at most, or `eq` exactly `value` times.
     *
     * @param string $op
     *
     * @return self
     */
    public function setOp(string $op): self
    {
        $this->initialized['op'] = true;
        $this->op = $op;
        return $this;
    }
    /**
     * The count compared with, from 1 to 1000000.
     *
     * @return int
     */
    public function getValue(): int
    {
        return $this->value;
    }
    /**
     * The count compared with, from 1 to 1000000.
     *
     * @param int $value
     *
     * @return self
     */
    public function setValue(int $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
}