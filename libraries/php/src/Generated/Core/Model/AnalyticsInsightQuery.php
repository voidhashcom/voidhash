<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsInsightQuery
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
     * @var list<AnalyticsBreakdown>|null
     */
    protected $breakdowns;
    /**
     * @var AnalyticsFilterPredicate|object|object|object
     */
    protected $filter;
    /**
     * @var string|null
     */
    protected $granularity;
    /**
     * @var string
     */
    protected $insightId;
    /**
     * @var string
     */
    protected $key;
    /**
     * @var mixed|null
     */
    protected $limit;
    /**
     * @var mixed
     */
    protected $timeRange;
    /**
     * @return list<AnalyticsBreakdown>|null
     */
    public function getBreakdowns(): ?array
    {
        return $this->breakdowns;
    }
    /**
     * @param list<AnalyticsBreakdown>|null $breakdowns
     *
     * @return self
     */
    public function setBreakdowns(?array $breakdowns): self
    {
        $this->initialized['breakdowns'] = true;
        $this->breakdowns = $breakdowns;
        return $this;
    }
    /**
     * @return AnalyticsFilterPredicate|object|object|object
     */
    public function getFilter()
    {
        return $this->filter;
    }
    /**
     * @param AnalyticsFilterPredicate|object|object|object $filter
     *
     * @return self
     */
    public function setFilter($filter): self
    {
        $this->initialized['filter'] = true;
        $this->filter = $filter;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getGranularity(): ?string
    {
        return $this->granularity;
    }
    /**
     * @param string|null $granularity
     *
     * @return self
     */
    public function setGranularity(?string $granularity): self
    {
        $this->initialized['granularity'] = true;
        $this->granularity = $granularity;
        return $this;
    }
    /**
     * @return string
     */
    public function getInsightId(): string
    {
        return $this->insightId;
    }
    /**
     * @param string $insightId
     *
     * @return self
     */
    public function setInsightId(string $insightId): self
    {
        $this->initialized['insightId'] = true;
        $this->insightId = $insightId;
        return $this;
    }
    /**
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getLimit()
    {
        return $this->limit;
    }
    /**
     * @param mixed $limit
     *
     * @return self
     */
    public function setLimit($limit): self
    {
        $this->initialized['limit'] = true;
        $this->limit = $limit;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getTimeRange()
    {
        return $this->timeRange;
    }
    /**
     * @param mixed $timeRange
     *
     * @return self
     */
    public function setTimeRange($timeRange): self
    {
        $this->initialized['timeRange'] = true;
        $this->timeRange = $timeRange;
        return $this;
    }
}