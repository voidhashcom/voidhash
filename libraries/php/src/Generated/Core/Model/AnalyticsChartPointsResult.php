<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartPointsResult
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
     * Always `points`.
     *
     * @var string
     */
    protected $shape;
    /**
     * What the values are: `count`; `money`, in integer minor units of the result's `currency`; `rate`, a share from 0 to 1; `ratio` or `score`; or a duration in `milliseconds`, `seconds`, `minutes` or `days`.
     *
     * @var string
     */
    protected $unit;
    /**
     * The places.
     *
     * @var list<AnalyticsChartPointsResultPointsItem>
     */
    protected $points;
    /**
     * Always `points`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `points`.
     *
     * @param string $shape
     *
     * @return self
     */
    public function setShape(string $shape): self
    {
        $this->initialized['shape'] = true;
        $this->shape = $shape;
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
     * The places.
     *
     * @return list<AnalyticsChartPointsResultPointsItem>
     */
    public function getPoints(): array
    {
        return $this->points;
    }
    /**
     * The places.
     *
     * @param list<AnalyticsChartPointsResultPointsItem> $points
     *
     * @return self
     */
    public function setPoints(array $points): self
    {
        $this->initialized['points'] = true;
        $this->points = $points;
        return $this;
    }
}