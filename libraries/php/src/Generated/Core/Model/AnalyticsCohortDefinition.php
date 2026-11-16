<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCohortDefinition
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
     * Whether people must match `all` of the conditions, or `any` one of them.
     *
     * @var string
     */
    protected $match;
    /**
     * 1 to 20 conditions.
     *
     * @var list<AnalyticsCohortTraitCondition>|list<AnalyticsCohortPerformedCondition>|list<AnalyticsCohortFirstTimeCondition>|list<AnalyticsCohortCohortCondition>|list<AnalyticsCohortGroupCondition>
     */
    protected $conditions;
    /**
     * Whether people must match `all` of the conditions, or `any` one of them.
     *
     * @return string
     */
    public function getMatch(): string
    {
        return $this->match;
    }
    /**
     * Whether people must match `all` of the conditions, or `any` one of them.
     *
     * @param string $match
     *
     * @return self
     */
    public function setMatch(string $match): self
    {
        $this->initialized['match'] = true;
        $this->match = $match;
        return $this;
    }
    /**
     * 1 to 20 conditions.
     *
     * @return list<AnalyticsCohortTraitCondition>|list<AnalyticsCohortPerformedCondition>|list<AnalyticsCohortFirstTimeCondition>|list<AnalyticsCohortCohortCondition>|list<AnalyticsCohortGroupCondition>
     */
    public function getConditions(): array
    {
        return $this->conditions;
    }
    /**
     * 1 to 20 conditions.
     *
     * @param list<AnalyticsCohortTraitCondition>|list<AnalyticsCohortPerformedCondition>|list<AnalyticsCohortFirstTimeCondition>|list<AnalyticsCohortCohortCondition>|list<AnalyticsCohortGroupCondition> $conditions
     *
     * @return self
     */
    public function setConditions(array $conditions): self
    {
        $this->initialized['conditions'] = true;
        $this->conditions = $conditions;
        return $this;
    }
}