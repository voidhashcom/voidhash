<?php

namespace Voidhash\Generated\Core\Model;

class InsightsReportBodyJsonEncoding
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
     * The insights to compute, 1 to 20. Results come back in the same order.
     *
     * @var list<AnalyticsInsightQuery>
     */
    protected $queries;
    /**
     * The insights to compute, 1 to 20. Results come back in the same order.
     *
     * @return list<AnalyticsInsightQuery>
     */
    public function getQueries(): array
    {
        return $this->queries;
    }
    /**
     * The insights to compute, 1 to 20. Results come back in the same order.
     *
     * @param list<AnalyticsInsightQuery> $queries
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