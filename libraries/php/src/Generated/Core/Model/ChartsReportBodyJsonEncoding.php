<?php

namespace Voidhash\Generated\Core\Model;

class ChartsReportBodyJsonEncoding
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
     * The charts to compute, 1 to 20.
     *
     * @var list<AnalyticsChartQuery>
     */
    protected $queries;
    /**
     * The charts to compute, 1 to 20.
     *
     * @return list<AnalyticsChartQuery>
     */
    public function getQueries(): array
    {
        return $this->queries;
    }
    /**
     * The charts to compute, 1 to 20.
     *
     * @param list<AnalyticsChartQuery> $queries
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