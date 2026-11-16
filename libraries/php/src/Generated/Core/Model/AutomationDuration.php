<?php

namespace Voidhash\Generated\Core\Model;

class AutomationDuration
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
     * How many `unit`s.
     *
     * @var int
     */
    protected $amount;
    /**
     * The unit of `amount`: `minutes`, `hours` or `days`.
     *
     * @var string
     */
    protected $unit;
    /**
     * How many `unit`s.
     *
     * @return int
     */
    public function getAmount(): int
    {
        return $this->amount;
    }
    /**
     * How many `unit`s.
     *
     * @param int $amount
     *
     * @return self
     */
    public function setAmount(int $amount): self
    {
        $this->initialized['amount'] = true;
        $this->amount = $amount;
        return $this;
    }
    /**
     * The unit of `amount`: `minutes`, `hours` or `days`.
     *
     * @return string
     */
    public function getUnit(): string
    {
        return $this->unit;
    }
    /**
     * The unit of `amount`: `minutes`, `hours` or `days`.
     *
     * @param string $unit
     *
     * @return self
     */
    public function setUnit(string $unit): self
    {
        $this->initialized['unit'] = true;
        $this->unit = $unit;
        return $this;
    }
}