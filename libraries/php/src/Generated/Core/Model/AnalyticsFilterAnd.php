<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsFilterAnd
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
     * The filters that must all match.
     *
     * @var list<AnalyticsFilterPredicate>|list<AnalyticsFilterAnd>|list<AnalyticsFilterOr>|list<AnalyticsFilterNot>
     */
    protected $filters;
    /**
     * Always `and`.
     *
     * @var string
     */
    protected $type;
    /**
     * The filters that must all match.
     *
     * @return list<AnalyticsFilterPredicate>|list<AnalyticsFilterAnd>|list<AnalyticsFilterOr>|list<AnalyticsFilterNot>
     */
    public function getFilters(): array
    {
        return $this->filters;
    }
    /**
     * The filters that must all match.
     *
     * @param list<AnalyticsFilterPredicate>|list<AnalyticsFilterAnd>|list<AnalyticsFilterOr>|list<AnalyticsFilterNot> $filters
     *
     * @return self
     */
    public function setFilters(array $filters): self
    {
        $this->initialized['filters'] = true;
        $this->filters = $filters;
        return $this;
    }
    /**
     * Always `and`.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * Always `and`.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
}