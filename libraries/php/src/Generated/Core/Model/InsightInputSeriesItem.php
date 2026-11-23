<?php

namespace Voidhash\Generated\Core\Model;

class InsightInputSeriesItem
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
     * What the series measures: `mrr` (monthly recurring revenue), `revenue`, or `event` (an event the app sends, named in `event`).
     *
     * @var string
     */
    protected $metric;
    /**
     * The event an `event` series counts, such as `paywall_viewed`.
     *
     * @var string
     */
    protected $event;
    /**
     * How an `event` series counts its events in each period: count, unique_people, unique_sessions, unique_groups, first_time, weekly_active, monthly_active, per_person, property. `count` unless given.
     *
     * @var string
     */
    protected $aggregation;
    /**
     * What a `per_person` or `property` aggregation takes of its numbers: sum, average, minimum, maximum, median, p75, p90, p95, p99.
     *
     * @var string
     */
    protected $statistic;
    /**
     * The numeric event property a `property` aggregation reads.
     *
     * @var string
     */
    protected $property;
    /**
     * The group type whose groups a `unique_groups` aggregation counts, such as `organization`.
     *
     * @var string
     */
    protected $groupType;
    /**
     * Filters that narrow this series alone, at most 10; none unless given.
     *
     * @var list<ExploreFilter>
     */
    protected $filters;
    /**
     * What the series measures: `mrr` (monthly recurring revenue), `revenue`, or `event` (an event the app sends, named in `event`).
     *
     * @return string
     */
    public function getMetric(): string
    {
        return $this->metric;
    }
    /**
     * What the series measures: `mrr` (monthly recurring revenue), `revenue`, or `event` (an event the app sends, named in `event`).
     *
     * @param string $metric
     *
     * @return self
     */
    public function setMetric(string $metric): self
    {
        $this->initialized['metric'] = true;
        $this->metric = $metric;
        return $this;
    }
    /**
     * The event an `event` series counts, such as `paywall_viewed`.
     *
     * @return string
     */
    public function getEvent(): string
    {
        return $this->event;
    }
    /**
     * The event an `event` series counts, such as `paywall_viewed`.
     *
     * @param string $event
     *
     * @return self
     */
    public function setEvent(string $event): self
    {
        $this->initialized['event'] = true;
        $this->event = $event;
        return $this;
    }
    /**
     * How an `event` series counts its events in each period: count, unique_people, unique_sessions, unique_groups, first_time, weekly_active, monthly_active, per_person, property. `count` unless given.
     *
     * @return string
     */
    public function getAggregation(): string
    {
        return $this->aggregation;
    }
    /**
     * How an `event` series counts its events in each period: count, unique_people, unique_sessions, unique_groups, first_time, weekly_active, monthly_active, per_person, property. `count` unless given.
     *
     * @param string $aggregation
     *
     * @return self
     */
    public function setAggregation(string $aggregation): self
    {
        $this->initialized['aggregation'] = true;
        $this->aggregation = $aggregation;
        return $this;
    }
    /**
     * What a `per_person` or `property` aggregation takes of its numbers: sum, average, minimum, maximum, median, p75, p90, p95, p99.
     *
     * @return string
     */
    public function getStatistic(): string
    {
        return $this->statistic;
    }
    /**
     * What a `per_person` or `property` aggregation takes of its numbers: sum, average, minimum, maximum, median, p75, p90, p95, p99.
     *
     * @param string $statistic
     *
     * @return self
     */
    public function setStatistic(string $statistic): self
    {
        $this->initialized['statistic'] = true;
        $this->statistic = $statistic;
        return $this;
    }
    /**
     * The numeric event property a `property` aggregation reads.
     *
     * @return string
     */
    public function getProperty(): string
    {
        return $this->property;
    }
    /**
     * The numeric event property a `property` aggregation reads.
     *
     * @param string $property
     *
     * @return self
     */
    public function setProperty(string $property): self
    {
        $this->initialized['property'] = true;
        $this->property = $property;
        return $this;
    }
    /**
     * The group type whose groups a `unique_groups` aggregation counts, such as `organization`.
     *
     * @return string
     */
    public function getGroupType(): string
    {
        return $this->groupType;
    }
    /**
     * The group type whose groups a `unique_groups` aggregation counts, such as `organization`.
     *
     * @param string $groupType
     *
     * @return self
     */
    public function setGroupType(string $groupType): self
    {
        $this->initialized['groupType'] = true;
        $this->groupType = $groupType;
        return $this;
    }
    /**
     * Filters that narrow this series alone, at most 10; none unless given.
     *
     * @return list<ExploreFilter>
     */
    public function getFilters(): array
    {
        return $this->filters;
    }
    /**
     * Filters that narrow this series alone, at most 10; none unless given.
     *
     * @param list<ExploreFilter> $filters
     *
     * @return self
     */
    public function setFilters(array $filters): self
    {
        $this->initialized['filters'] = true;
        $this->filters = $filters;
        return $this;
    }
}