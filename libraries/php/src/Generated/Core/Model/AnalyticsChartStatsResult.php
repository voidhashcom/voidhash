<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartStatsResult
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
     * Always `stats`.
     *
     * @var string
     */
    protected $shape;
    /**
     * The numbers, in order.
     *
     * @var list<AnalyticsChartStatsResultStatsItem>
     */
    protected $stats;
    /**
     * Always `stats`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `stats`.
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
     * The numbers, in order.
     *
     * @return list<AnalyticsChartStatsResultStatsItem>
     */
    public function getStats(): array
    {
        return $this->stats;
    }
    /**
     * The numbers, in order.
     *
     * @param list<AnalyticsChartStatsResultStatsItem> $stats
     *
     * @return self
     */
    public function setStats(array $stats): self
    {
        $this->initialized['stats'] = true;
        $this->stats = $stats;
        return $this;
    }
}