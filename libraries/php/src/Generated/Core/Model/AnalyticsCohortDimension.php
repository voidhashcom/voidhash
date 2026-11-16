<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCohortDimension
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
     * The cohorts a split compares, 1 to 5 ids, each a group of its own keyed by its id and labelled by its name. Splits only: a filter names its cohorts in its values.
     *
     * @var list<string>|null
     */
    protected $cohortIds;
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
     * The cohorts a split compares, 1 to 5 ids, each a group of its own keyed by its id and labelled by its name. Splits only: a filter names its cohorts in its values.
     *
     * @return list<string>|null
     */
    public function getCohortIds(): ?array
    {
        return $this->cohortIds;
    }
    /**
     * The cohorts a split compares, 1 to 5 ids, each a group of its own keyed by its id and labelled by its name. Splits only: a filter names its cohorts in its values.
     *
     * @param list<string>|null $cohortIds
     *
     * @return self
     */
    public function setCohortIds(?array $cohortIds): self
    {
        $this->initialized['cohortIds'] = true;
        $this->cohortIds = $cohortIds;
        return $this;
    }
}