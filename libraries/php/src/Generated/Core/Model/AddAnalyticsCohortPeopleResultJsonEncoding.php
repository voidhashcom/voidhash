<?php

namespace Voidhash\Generated\Core\Model;

class AddAnalyticsCohortPeopleResultJsonEncoding
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
     * @var AnalyticsCohortJsonEncoding
     */
    protected $cohort;
    /**
     * How many people joined; those already in the cohort aren't counted.
     *
     * @var int
     */
    protected $added;
    /**
     * The identifiers no current person of the project has, as they were sent.
     *
     * @var list<string>
     */
    protected $unresolved;
    /**
     * @return AnalyticsCohortJsonEncoding
     */
    public function getCohort(): AnalyticsCohortJsonEncoding
    {
        return $this->cohort;
    }
    /**
     * @param AnalyticsCohortJsonEncoding $cohort
     *
     * @return self
     */
    public function setCohort(AnalyticsCohortJsonEncoding $cohort): self
    {
        $this->initialized['cohort'] = true;
        $this->cohort = $cohort;
        return $this;
    }
    /**
     * How many people joined; those already in the cohort aren't counted.
     *
     * @return int
     */
    public function getAdded(): int
    {
        return $this->added;
    }
    /**
     * How many people joined; those already in the cohort aren't counted.
     *
     * @param int $added
     *
     * @return self
     */
    public function setAdded(int $added): self
    {
        $this->initialized['added'] = true;
        $this->added = $added;
        return $this;
    }
    /**
     * The identifiers no current person of the project has, as they were sent.
     *
     * @return list<string>
     */
    public function getUnresolved(): array
    {
        return $this->unresolved;
    }
    /**
     * The identifiers no current person of the project has, as they were sent.
     *
     * @param list<string> $unresolved
     *
     * @return self
     */
    public function setUnresolved(array $unresolved): self
    {
        $this->initialized['unresolved'] = true;
        $this->unresolved = $unresolved;
        return $this;
    }
}