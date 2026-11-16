<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCohortPerformedCondition
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
    protected $event;
    /**
     * Keeps the people who did not do it as `count` says instead.
     *
     * @var bool
     */
    protected $isNegated;
    /**
     * @var AnalyticsCohortEventCount
     */
    protected $count;
    /**
     * The days, ending now, the events are counted over: 1 to 365.
     *
     * @var int
     */
    protected $withinDays;
    /**
     * Property filters on the event, so only the events they keep count.
     *
     * @var list<AnalyticsCohortEventFilter>
     */
    protected $filters;
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
    public function getEvent(): string
    {
        return $this->event;
    }
    /**
     * The event, by the name the app sends.
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
     * Keeps the people who did not do it as `count` says instead.
     *
     * @return bool
     */
    public function getIsNegated(): bool
    {
        return $this->isNegated;
    }
    /**
     * Keeps the people who did not do it as `count` says instead.
     *
     * @param bool $isNegated
     *
     * @return self
     */
    public function setIsNegated(bool $isNegated): self
    {
        $this->initialized['isNegated'] = true;
        $this->isNegated = $isNegated;
        return $this;
    }
    /**
     * @return AnalyticsCohortEventCount
     */
    public function getCount(): AnalyticsCohortEventCount
    {
        return $this->count;
    }
    /**
     * @param AnalyticsCohortEventCount $count
     *
     * @return self
     */
    public function setCount(AnalyticsCohortEventCount $count): self
    {
        $this->initialized['count'] = true;
        $this->count = $count;
        return $this;
    }
    /**
     * The days, ending now, the events are counted over: 1 to 365.
     *
     * @return int
     */
    public function getWithinDays(): int
    {
        return $this->withinDays;
    }
    /**
     * The days, ending now, the events are counted over: 1 to 365.
     *
     * @param int $withinDays
     *
     * @return self
     */
    public function setWithinDays(int $withinDays): self
    {
        $this->initialized['withinDays'] = true;
        $this->withinDays = $withinDays;
        return $this;
    }
    /**
     * Property filters on the event, so only the events they keep count.
     *
     * @return list<AnalyticsCohortEventFilter>
     */
    public function getFilters(): array
    {
        return $this->filters;
    }
    /**
     * Property filters on the event, so only the events they keep count.
     *
     * @param list<AnalyticsCohortEventFilter> $filters
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