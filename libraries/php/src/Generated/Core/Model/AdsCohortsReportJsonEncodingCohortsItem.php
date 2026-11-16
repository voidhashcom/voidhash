<?php

namespace Voidhash\Generated\Core\Model;

class AdsCohortsReportJsonEncodingCohortsItem
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
     * The cohort's first day: the Monday of the week, or the first of the month.
     *
     * @var string
     */
    protected $start;
    /**
     * Spend on the cohort's acquisition days, in minor units.
     *
     * @var int
     */
    protected $spend;
    /**
     * People acquired in the cohort.
     *
     * @var int
     */
    protected $people;
    /**
     * The metric by day since acquisition.
     *
     * @var list<AdsCohortsReportJsonEncodingCohortsItemValuesItem>
     */
    protected $values;
    /**
     * The cohort's first day: the Monday of the week, or the first of the month.
     *
     * @return string
     */
    public function getStart(): string
    {
        return $this->start;
    }
    /**
     * The cohort's first day: the Monday of the week, or the first of the month.
     *
     * @param string $start
     *
     * @return self
     */
    public function setStart(string $start): self
    {
        $this->initialized['start'] = true;
        $this->start = $start;
        return $this;
    }
    /**
     * Spend on the cohort's acquisition days, in minor units.
     *
     * @return int
     */
    public function getSpend(): int
    {
        return $this->spend;
    }
    /**
     * Spend on the cohort's acquisition days, in minor units.
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
     * People acquired in the cohort.
     *
     * @return int
     */
    public function getPeople(): int
    {
        return $this->people;
    }
    /**
     * People acquired in the cohort.
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
     * @return list<AdsCohortsReportJsonEncodingCohortsItemValuesItem>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * The metric by day since acquisition.
     *
     * @param list<AdsCohortsReportJsonEncodingCohortsItemValuesItem> $values
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