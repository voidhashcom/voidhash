<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartCurvesResult
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
     * Always `curves`.
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
     * What the offsets count since the start.
     *
     * @var string
     */
    protected $axis;
    /**
     * The days, weeks or months since the start that each value is for, from 0.
     *
     * @var list<int>
     */
    protected $offsets;
    /**
     * The curves.
     *
     * @var list<AnalyticsChartCurvesResultSeriesItem>
     */
    protected $series;
    /**
     * Always `curves`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `curves`.
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
     * What the offsets count since the start.
     *
     * @return string
     */
    public function getAxis(): string
    {
        return $this->axis;
    }
    /**
     * What the offsets count since the start.
     *
     * @param string $axis
     *
     * @return self
     */
    public function setAxis(string $axis): self
    {
        $this->initialized['axis'] = true;
        $this->axis = $axis;
        return $this;
    }
    /**
     * The days, weeks or months since the start that each value is for, from 0.
     *
     * @return list<int>
     */
    public function getOffsets(): array
    {
        return $this->offsets;
    }
    /**
     * The days, weeks or months since the start that each value is for, from 0.
     *
     * @param list<int> $offsets
     *
     * @return self
     */
    public function setOffsets(array $offsets): self
    {
        $this->initialized['offsets'] = true;
        $this->offsets = $offsets;
        return $this;
    }
    /**
     * The curves.
     *
     * @return list<AnalyticsChartCurvesResultSeriesItem>
     */
    public function getSeries(): array
    {
        return $this->series;
    }
    /**
     * The curves.
     *
     * @param list<AnalyticsChartCurvesResultSeriesItem> $series
     *
     * @return self
     */
    public function setSeries(array $series): self
    {
        $this->initialized['series'] = true;
        $this->series = $series;
        return $this;
    }
}