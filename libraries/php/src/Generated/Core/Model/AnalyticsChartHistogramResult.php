<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartHistogramResult
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
     * Always `histogram`.
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
     * The bins, in ascending order.
     *
     * @var list<AnalyticsChartHistogramResultBinsItem>
     */
    protected $bins;
    /**
     * The median value; null when there is none.
     *
     * @var float|null
     */
    protected $median;
    /**
     * How many there are across all bins.
     *
     * @var float
     */
    protected $total;
    /**
     * Always `histogram`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `histogram`.
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
     * The bins, in ascending order.
     *
     * @return list<AnalyticsChartHistogramResultBinsItem>
     */
    public function getBins(): array
    {
        return $this->bins;
    }
    /**
     * The bins, in ascending order.
     *
     * @param list<AnalyticsChartHistogramResultBinsItem> $bins
     *
     * @return self
     */
    public function setBins(array $bins): self
    {
        $this->initialized['bins'] = true;
        $this->bins = $bins;
        return $this;
    }
    /**
     * The median value; null when there is none.
     *
     * @return float|null
     */
    public function getMedian(): ?float
    {
        return $this->median;
    }
    /**
     * The median value; null when there is none.
     *
     * @param float|null $median
     *
     * @return self
     */
    public function setMedian(?float $median): self
    {
        $this->initialized['median'] = true;
        $this->median = $median;
        return $this;
    }
    /**
     * How many there are across all bins.
     *
     * @return float
     */
    public function getTotal(): float
    {
        return $this->total;
    }
    /**
     * How many there are across all bins.
     *
     * @param float $total
     *
     * @return self
     */
    public function setTotal(float $total): self
    {
        $this->initialized['total'] = true;
        $this->total = $total;
        return $this;
    }
}