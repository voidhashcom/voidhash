<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartStatsResultStatsItem
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
     * The number's key.
     *
     * @var string
     */
    protected $key;
    /**
     * What the values are: `count`; `money`, in integer minor units of the result's `currency`; `rate`, a share from 0 to 1; `ratio` or `score`; or a duration in `milliseconds`, `seconds`, `minutes` or `days`.
     *
     * @var string
     */
    protected $unit;
    /**
     * The number; null when there is none.
     *
     * @var float|null
     */
    protected $value;
    /**
     * Its value in the period just before the range; only when `hasComparison` was set.
     *
     * @var float|null
     */
    protected $previous;
    /**
     * The number's key.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The number's key.
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
     * What the values are: `count`; `money`, in integer minor units of the result's `currency`; `rate`, a share from 0 to 1; `ratio` or `score`; or a duration in `milliseconds`, `seconds`, `minutes` or `days`.
     *
     * @return string
     */
    public function getUnit(): string
    {
        return $this->unit;
    }
    /**
     * What the values are: `count`; `money`, in integer minor units of the result's `currency`; `rate`, a share from 0 to 1; `ratio` or `score`; or a duration in `milliseconds`, `seconds`, `minutes` or `days`.
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
    /**
     * The number; null when there is none.
     *
     * @return float|null
     */
    public function getValue(): ?float
    {
        return $this->value;
    }
    /**
     * The number; null when there is none.
     *
     * @param float|null $value
     *
     * @return self
     */
    public function setValue(?float $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
    /**
     * Its value in the period just before the range; only when `hasComparison` was set.
     *
     * @return float|null
     */
    public function getPrevious(): ?float
    {
        return $this->previous;
    }
    /**
     * Its value in the period just before the range; only when `hasComparison` was set.
     *
     * @param float|null $previous
     *
     * @return self
     */
    public function setPrevious(?float $previous): self
    {
        $this->initialized['previous'] = true;
        $this->previous = $previous;
        return $this;
    }
}