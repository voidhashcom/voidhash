<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsFilterNot
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
     * A filter: one comparison, or `and`, `or` and `not` combining others.
     *
     * @var AnalyticsFilterPredicate|AnalyticsFilterAnd|AnalyticsFilterOr|AnalyticsFilterNot
     */
    protected $filter;
    /**
     * Always `not`.
     *
     * @var string
     */
    protected $type;
    /**
     * A filter: one comparison, or `and`, `or` and `not` combining others.
     *
     * @return AnalyticsFilterPredicate|AnalyticsFilterAnd|AnalyticsFilterOr|AnalyticsFilterNot
     */
    public function getFilter()
    {
        return $this->filter;
    }
    /**
     * A filter: one comparison, or `and`, `or` and `not` combining others.
     *
     * @param AnalyticsFilterPredicate|AnalyticsFilterAnd|AnalyticsFilterOr|AnalyticsFilterNot $filter
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
     * Always `not`.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * Always `not`.
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