<?php

namespace Voidhash\Generated\Core\Model;

class ChartsReportResultJsonEncoding
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
     * One result per query, in the order of the queries.
     *
     * @var list<AnalyticsChartResponseItem>
     */
    protected $results;
    /**
     * One result per query, in the order of the queries.
     *
     * @return list<AnalyticsChartResponseItem>
     */
    public function getResults(): array
    {
        return $this->results;
    }
    /**
     * One result per query, in the order of the queries.
     *
     * @param list<AnalyticsChartResponseItem> $results
     *
     * @return self
     */
    public function setResults(array $results): self
    {
        $this->initialized['results'] = true;
        $this->results = $results;
        return $this;
    }
}