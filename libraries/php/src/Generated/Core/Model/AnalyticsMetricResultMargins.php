<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsMetricResultMargins
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
     * The metric per group of `split` alone, the same series a query split by `split` alone returns with the same `limit`.
     *
     * @var list<AnalyticsMetricGroupSeries>
     */
    protected $first;
    /**
     * The metric per group of `secondSplit` alone, the same series a query split by `secondSplit` alone returns with `secondLimit` as its limit.
     *
     * @var list<AnalyticsMetricGroupSeries>
     */
    protected $second;
    /**
     * The metric per group of `split` alone, the same series a query split by `split` alone returns with the same `limit`.
     *
     * @return list<AnalyticsMetricGroupSeries>
     */
    public function getFirst(): array
    {
        return $this->first;
    }
    /**
     * The metric per group of `split` alone, the same series a query split by `split` alone returns with the same `limit`.
     *
     * @param list<AnalyticsMetricGroupSeries> $first
     *
     * @return self
     */
    public function setFirst(array $first): self
    {
        $this->initialized['first'] = true;
        $this->first = $first;
        return $this;
    }
    /**
     * The metric per group of `secondSplit` alone, the same series a query split by `secondSplit` alone returns with `secondLimit` as its limit.
     *
     * @return list<AnalyticsMetricGroupSeries>
     */
    public function getSecond(): array
    {
        return $this->second;
    }
    /**
     * The metric per group of `secondSplit` alone, the same series a query split by `secondSplit` alone returns with `secondLimit` as its limit.
     *
     * @param list<AnalyticsMetricGroupSeries> $second
     *
     * @return self
     */
    public function setSecond(array $second): self
    {
        $this->initialized['second'] = true;
        $this->second = $second;
        return $this;
    }
}