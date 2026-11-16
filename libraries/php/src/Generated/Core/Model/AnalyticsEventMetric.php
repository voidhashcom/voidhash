<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsEventMetric
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
     * @var string
     */
    protected $kind;
    /**
     * The event, by the name the app sends.
     *
     * @var string
     */
    protected $eventName;
    /**
     * How each period counts: `count` of the events; `unique_people` who sent it; `unique_sessions` it was sent in; `unique_groups`, the groups of `groupType` it was sent with; `first_time`, people sending it for the first time ever; `weekly_active` and `monthly_active`, people who sent it in the 7 or 30 days ending with the period; `per_person`, a `statistic` of how many times each person sent it; `property`, a `statistic` of a numeric `property`.
     *
     * @var string
     */
    protected $aggregation;
    /**
     * What `per_person` and `property` take of their numbers: `average` unless given. Not used by other aggregations.
     *
     * @var string|null
     */
    protected $statistic;
    /**
     * The numeric event property a `property` aggregation reads. Required by it alone.
     *
     * @var string|null
     */
    protected $property;
    /**
     * The group type a `unique_groups` aggregation counts, such as `organization`: events count by the group they name in `$groups`, and events without one aren't counted. Required by it alone.
     *
     * @var string|null
     */
    protected $groupType;
    /**
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * The event, by the name the app sends.
     *
     * @return string
     */
    public function getEventName(): string
    {
        return $this->eventName;
    }
    /**
     * The event, by the name the app sends.
     *
     * @param string $eventName
     *
     * @return self
     */
    public function setEventName(string $eventName): self
    {
        $this->initialized['eventName'] = true;
        $this->eventName = $eventName;
        return $this;
    }
    /**
     * How each period counts: `count` of the events; `unique_people` who sent it; `unique_sessions` it was sent in; `unique_groups`, the groups of `groupType` it was sent with; `first_time`, people sending it for the first time ever; `weekly_active` and `monthly_active`, people who sent it in the 7 or 30 days ending with the period; `per_person`, a `statistic` of how many times each person sent it; `property`, a `statistic` of a numeric `property`.
     *
     * @return string
     */
    public function getAggregation(): string
    {
        return $this->aggregation;
    }
    /**
     * How each period counts: `count` of the events; `unique_people` who sent it; `unique_sessions` it was sent in; `unique_groups`, the groups of `groupType` it was sent with; `first_time`, people sending it for the first time ever; `weekly_active` and `monthly_active`, people who sent it in the 7 or 30 days ending with the period; `per_person`, a `statistic` of how many times each person sent it; `property`, a `statistic` of a numeric `property`.
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
     * What `per_person` and `property` take of their numbers: `average` unless given. Not used by other aggregations.
     *
     * @return string|null
     */
    public function getStatistic(): ?string
    {
        return $this->statistic;
    }
    /**
     * What `per_person` and `property` take of their numbers: `average` unless given. Not used by other aggregations.
     *
     * @param string|null $statistic
     *
     * @return self
     */
    public function setStatistic(?string $statistic): self
    {
        $this->initialized['statistic'] = true;
        $this->statistic = $statistic;
        return $this;
    }
    /**
     * The numeric event property a `property` aggregation reads. Required by it alone.
     *
     * @return string|null
     */
    public function getProperty(): ?string
    {
        return $this->property;
    }
    /**
     * The numeric event property a `property` aggregation reads. Required by it alone.
     *
     * @param string|null $property
     *
     * @return self
     */
    public function setProperty(?string $property): self
    {
        $this->initialized['property'] = true;
        $this->property = $property;
        return $this;
    }
    /**
     * The group type a `unique_groups` aggregation counts, such as `organization`: events count by the group they name in `$groups`, and events without one aren't counted. Required by it alone.
     *
     * @return string|null
     */
    public function getGroupType(): ?string
    {
        return $this->groupType;
    }
    /**
     * The group type a `unique_groups` aggregation counts, such as `organization`: events count by the group they name in `$groups`, and events without one aren't counted. Required by it alone.
     *
     * @param string|null $groupType
     *
     * @return self
     */
    public function setGroupType(?string $groupType): self
    {
        $this->initialized['groupType'] = true;
        $this->groupType = $groupType;
        return $this;
    }
}