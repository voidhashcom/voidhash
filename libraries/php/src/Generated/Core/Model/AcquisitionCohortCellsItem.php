<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionCohortCellsItem
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
     * Days after each person's touch, one of the result's `days`.
     *
     * @var int
     */
    protected $day;
    /**
     * People who had signed up by the end of the day.
     *
     * @var int
     */
    protected $people;
    /**
     * People who had paid by the end of the day.
     *
     * @var int
     */
    protected $payingPeople;
    /**
     * Payments by the end of the day, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $grossRevenue;
    /**
     * Refunds by the end of the day, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $refunds;
    /**
     * `grossRevenue - refunds`, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $netRevenue;
    /**
     * `complete` once every person of the cohort is past the day, `maturing` while only some are.
     *
     * @var string
     */
    protected $maturity;
    /**
     * Days after each person's touch, one of the result's `days`.
     *
     * @return int
     */
    public function getDay(): int
    {
        return $this->day;
    }
    /**
     * Days after each person's touch, one of the result's `days`.
     *
     * @param int $day
     *
     * @return self
     */
    public function setDay(int $day): self
    {
        $this->initialized['day'] = true;
        $this->day = $day;
        return $this;
    }
    /**
     * People who had signed up by the end of the day.
     *
     * @return int
     */
    public function getPeople(): int
    {
        return $this->people;
    }
    /**
     * People who had signed up by the end of the day.
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
     * People who had paid by the end of the day.
     *
     * @return int
     */
    public function getPayingPeople(): int
    {
        return $this->payingPeople;
    }
    /**
     * People who had paid by the end of the day.
     *
     * @param int $payingPeople
     *
     * @return self
     */
    public function setPayingPeople(int $payingPeople): self
    {
        $this->initialized['payingPeople'] = true;
        $this->payingPeople = $payingPeople;
        return $this;
    }
    /**
     * Payments by the end of the day, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getGrossRevenue(): int
    {
        return $this->grossRevenue;
    }
    /**
     * Payments by the end of the day, in integer minor units of the report currency, such as cents.
     *
     * @param int $grossRevenue
     *
     * @return self
     */
    public function setGrossRevenue(int $grossRevenue): self
    {
        $this->initialized['grossRevenue'] = true;
        $this->grossRevenue = $grossRevenue;
        return $this;
    }
    /**
     * Refunds by the end of the day, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getRefunds(): int
    {
        return $this->refunds;
    }
    /**
     * Refunds by the end of the day, in integer minor units of the report currency, such as cents.
     *
     * @param int $refunds
     *
     * @return self
     */
    public function setRefunds(int $refunds): self
    {
        $this->initialized['refunds'] = true;
        $this->refunds = $refunds;
        return $this;
    }
    /**
     * `grossRevenue - refunds`, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getNetRevenue(): int
    {
        return $this->netRevenue;
    }
    /**
     * `grossRevenue - refunds`, in integer minor units of the report currency, such as cents.
     *
     * @param int $netRevenue
     *
     * @return self
     */
    public function setNetRevenue(int $netRevenue): self
    {
        $this->initialized['netRevenue'] = true;
        $this->netRevenue = $netRevenue;
        return $this;
    }
    /**
     * `complete` once every person of the cohort is past the day, `maturing` while only some are.
     *
     * @return string
     */
    public function getMaturity(): string
    {
        return $this->maturity;
    }
    /**
     * `complete` once every person of the cohort is past the day, `maturing` while only some are.
     *
     * @param string $maturity
     *
     * @return self
     */
    public function setMaturity(string $maturity): self
    {
        $this->initialized['maturity'] = true;
        $this->maturity = $maturity;
        return $this;
    }
}