<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartCohortsResult
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
     * Always `cohorts`.
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
     * The length of each cohort and of each step after it.
     *
     * @var string
     */
    protected $period;
    /**
     * The periods since a cohort started that each value is for, from 0.
     *
     * @var list<int>
     */
    protected $offsets;
    /**
     * The cohorts.
     *
     * @var list<AnalyticsChartCohortsResultCohortsItem>
     */
    protected $cohorts;
    /**
     * Always `cohorts`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `cohorts`.
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
     * The length of each cohort and of each step after it.
     *
     * @return string
     */
    public function getPeriod(): string
    {
        return $this->period;
    }
    /**
     * The length of each cohort and of each step after it.
     *
     * @param string $period
     *
     * @return self
     */
    public function setPeriod(string $period): self
    {
        $this->initialized['period'] = true;
        $this->period = $period;
        return $this;
    }
    /**
     * The periods since a cohort started that each value is for, from 0.
     *
     * @return list<int>
     */
    public function getOffsets(): array
    {
        return $this->offsets;
    }
    /**
     * The periods since a cohort started that each value is for, from 0.
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
     * The cohorts.
     *
     * @return list<AnalyticsChartCohortsResultCohortsItem>
     */
    public function getCohorts(): array
    {
        return $this->cohorts;
    }
    /**
     * The cohorts.
     *
     * @param list<AnalyticsChartCohortsResultCohortsItem> $cohorts
     *
     * @return self
     */
    public function setCohorts(array $cohorts): self
    {
        $this->initialized['cohorts'] = true;
        $this->cohorts = $cohorts;
        return $this;
    }
}