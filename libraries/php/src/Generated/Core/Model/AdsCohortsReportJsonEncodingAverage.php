<?php

namespace Voidhash\Generated\Core\Model;

class AdsCohortsReportJsonEncodingAverage
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
     * Spend of every cohort together, in minor units.
     *
     * @var int
     */
    protected $spend;
    /**
     * People of every cohort together.
     *
     * @var int
     */
    protected $people;
    /**
     * The metric by day since acquisition.
     *
     * @var list<AdsCohortValue>
     */
    protected $values;
    /**
     * Spend of every cohort together, in minor units.
     *
     * @return int
     */
    public function getSpend(): int
    {
        return $this->spend;
    }
    /**
     * Spend of every cohort together, in minor units.
     *
     * @param int $spend
     *
     * @return self
     */
    public function setSpend(int $spend): self
    {
        $this->initialized['spend'] = true;
        $this->spend = $spend;
        return $this;
    }
    /**
     * People of every cohort together.
     *
     * @return int
     */
    public function getPeople(): int
    {
        return $this->people;
    }
    /**
     * People of every cohort together.
     *
     * @param int $people
     *
     * @return self
     */
    public function setPeople(int $people): self
    {
        $this->initialized['people'] = true;
        $this->people = $people;
        return $this;
    }
    /**
     * The metric by day since acquisition.
     *
     * @return list<AdsCohortValue>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * The metric by day since acquisition.
     *
     * @param list<AdsCohortValue> $values
     *
     * @return self
     */
    public function setValues(array $values): self
    {
        $this->initialized['values'] = true;
        $this->values = $values;
        return $this;
    }
}