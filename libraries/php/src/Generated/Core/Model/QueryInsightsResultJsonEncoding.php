<?php

namespace Voidhash\Generated\Core\Model;

class QueryInsightsResultJsonEncoding
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
     * @var list<AnalyticsInsightResponseItem>
     */
    protected $results;
    /**
     * @return list<AnalyticsInsightResponseItem>
     */
    public function getResults(): array
    {
        return $this->results;
    }
    /**
     * @param list<AnalyticsInsightResponseItem> $results
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