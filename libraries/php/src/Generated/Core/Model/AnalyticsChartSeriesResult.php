<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartSeriesResult
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
     * Always `series`.
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
     * The start of each bucket of the range, as ISO 8601 timestamps; every series has a value per bucket.
     *
     * @var list<string>
     */
    protected $buckets;
    /**
     * The series.
     *
     * @var list<AnalyticsChartSeriesResultSeriesItem>
     */
    protected $series;
    /**
     * Always `series`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `series`.
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
     * The start of each bucket of the range, as ISO 8601 timestamps; every series has a value per bucket.
     *
     * @return list<string>
     */
    public function getBuckets(): array
    {
        return $this->buckets;
    }
    /**
     * The start of each bucket of the range, as ISO 8601 timestamps; every series has a value per bucket.
     *
     * @param list<string> $buckets
     *
     * @return self
     */
    public function setBuckets(array $buckets): self
    {
        $this->initialized['buckets'] = true;
        $this->buckets = $buckets;
        return $this;
    }
    /**
     * The series.
     *
     * @return list<AnalyticsChartSeriesResultSeriesItem>
     */
    public function getSeries(): array
    {
        return $this->series;
    }
    /**
     * The series.
     *
     * @param list<AnalyticsChartSeriesResultSeriesItem> $series
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