<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionCohort
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
     * The Monday of the cohort's week, `YYYY-MM-DD`, in the report time zone.
     *
     * @var string
     */
    protected $week;
    /**
     * The first acquisition day of the week within the range, `YYYY-MM-DD`.
     *
     * @var string
     */
    protected $from;
    /**
     * The last acquisition day of the week within the range, `YYYY-MM-DD`.
     *
     * @var string
     */
    protected $to;
    /**
     * People acquired: those whose signup was credited to a touch in the week.
     *
     * @var int
     */
    protected $people;
    /**
     * Cumulative outcomes by the end of day N after each person's touch; days nobody has reached are absent.
     *
     * @var list<AcquisitionCohortCellsItem>
     */
    protected $cells;
    /**
     * Net revenue projected by the end of each day some of the cohort have not passed: what was measured so far plus what its people are expected to pay, from the project's own renewal, trial and first-payment history. Empty without enough history to project from.
     *
     * @var list<AcquisitionCohortProjection>
     */
    protected $projections;
    /**
     * The Monday of the cohort's week, `YYYY-MM-DD`, in the report time zone.
     *
     * @return string
     */
    public function getWeek(): string
    {
        return $this->week;
    }
    /**
     * The Monday of the cohort's week, `YYYY-MM-DD`, in the report time zone.
     *
     * @param string $week
     *
     * @return self
     */
    public function setWeek(string $week): self
    {
        $this->initialized['week'] = true;
        $this->week = $week;
        return $this;
    }
    /**
     * The first acquisition day of the week within the range, `YYYY-MM-DD`.
     *
     * @return string
     */
    public function getFrom(): string
    {
        return $this->from;
    }
    /**
     * The first acquisition day of the week within the range, `YYYY-MM-DD`.
     *
     * @param string $from
     *
     * @return self
     */
    public function setFrom(string $from): self
    {
        $this->initialized['from'] = true;
        $this->from = $from;
        return $this;
    }
    /**
     * The last acquisition day of the week within the range, `YYYY-MM-DD`.
     *
     * @return string
     */
    public function getTo(): string
    {
        return $this->to;
    }
    /**
     * The last acquisition day of the week within the range, `YYYY-MM-DD`.
     *
     * @param string $to
     *
     * @return self
     */
    public function setTo(string $to): self
    {
        $this->initialized['to'] = true;
        $this->to = $to;
        return $this;
    }
    /**
     * People acquired: those whose signup was credited to a touch in the week.
     *
     * @return int
     */
    public function getPeople(): int
    {
        return $this->people;
    }
    /**
     * People acquired: those whose signup was credited to a touch in the week.
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
     * Cumulative outcomes by the end of day N after each person's touch; days nobody has reached are absent.
     *
     * @return list<AcquisitionCohortCellsItem>
     */
    public function getCells(): array
    {
        return $this->cells;
    }
    /**
     * Cumulative outcomes by the end of day N after each person's touch; days nobody has reached are absent.
     *
     * @param list<AcquisitionCohortCellsItem> $cells
     *
     * @return self
     */
    public function setCells(array $cells): self
    {
        $this->initialized['cells'] = true;
        $this->cells = $cells;
        return $this;
    }
    /**
     * Net revenue projected by the end of each day some of the cohort have not passed: what was measured so far plus what its people are expected to pay, from the project's own renewal, trial and first-payment history. Empty without enough history to project from.
     *
     * @return list<AcquisitionCohortProjection>
     */
    public function getProjections(): array
    {
        return $this->projections;
    }
    /**
     * Net revenue projected by the end of each day some of the cohort have not passed: what was measured so far plus what its people are expected to pay, from the project's own renewal, trial and first-payment history. Empty without enough history to project from.
     *
     * @param list<AcquisitionCohortProjection> $projections
     *
     * @return self
     */
    public function setProjections(array $projections): self
    {
        $this->initialized['projections'] = true;
        $this->projections = $projections;
        return $this;
    }
}