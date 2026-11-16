<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartTableResultColumnsItem
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
     * The column's key in each row's `values`.
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
     * The column's key in each row's `values`.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The column's key in each row's `values`.
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
}