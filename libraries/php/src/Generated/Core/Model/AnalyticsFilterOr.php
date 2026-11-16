<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsFilterOr
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
     * The filters of which at least one must match. Insights accept an `or` only when all of them compare the same field.
     *
     * @var list<AnalyticsFilterPredicate>|list<AnalyticsFilterAnd>|list<AnalyticsFilterOr>|list<AnalyticsFilterNot>
     */
    protected $filters;
    /**
     * Always `or`.
     *
     * @var string
     */
    protected $type;
    /**
     * The filters of which at least one must match. Insights accept an `or` only when all of them compare the same field.
     *
     * @return list<AnalyticsFilterPredicate>|list<AnalyticsFilterAnd>|list<AnalyticsFilterOr>|list<AnalyticsFilterNot>
     */
    public function getFilters(): array
    {
        return $this->filters;
    }
    /**
     * The filters of which at least one must match. Insights accept an `or` only when all of them compare the same field.
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
     * Always `or`.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * Always `or`.
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