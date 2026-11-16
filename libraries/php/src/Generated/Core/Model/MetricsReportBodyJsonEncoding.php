<?php

namespace Voidhash\Generated\Core\Model;

class MetricsReportBodyJsonEncoding
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
     * The metrics to measure, 1 to 20.
     *
     * @var list<AnalyticsMetricQuery>
     */
    protected $queries;
    /**
     * The metrics to measure, 1 to 20.
     *
     * @return list<AnalyticsMetricQuery>
     */
    public function getQueries(): array
    {
        return $this->queries;
    }
    /**
     * The metrics to measure, 1 to 20.
     *
     * @param list<AnalyticsMetricQuery> $queries
     *
     * @return self
     */
    public function setQueries(array $queries): self
    {
        $this->initialized['queries'] = true;
        $this->queries = $queries;
        return $this;
    }
}