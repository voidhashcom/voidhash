<?php

namespace Voidhash\Generated\Core\Model;

class AdsCohortsReportJsonEncodingCohortsItemValuesItem
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
     * Days since acquisition, from 0.
     *
     * @var int
     */
    protected $day;
    /**
     * The report's `metric` on the day; null before the cohort reached it. Averages over cohorts can make even `payers` fractional.
     *
     * @var float|null
     */
    protected $value;
    /**
     * A projected ROAS and its 10th to 90th percentile range.
     *
     * @var AdsProjectedCohortValue
     */
    protected $projected;
    /**
     * Whether some of the cohort's people are still inside the day's window, so the value can grow.
     *
     * @var bool
     */
    protected $isMaturing;
    /**
     * Days since acquisition, from 0.
     *
     * @return int
     */
    public function getDay(): int
    {
        return $this->day;
    }
    /**
     * Days since acquisition, from 0.
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
     * The report's `metric` on the day; null before the cohort reached it. Averages over cohorts can make even `payers` fractional.
     *
     * @return float|null
     */
    public function getValue(): ?float
    {
        return $this->value;
    }
    /**
     * The report's `metric` on the day; null before the cohort reached it. Averages over cohorts can make even `payers` fractional.
     *
     * @param float|null $value
     *
     * @return self
     */
    public function setValue(?float $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
    /**
     * A projected ROAS and its 10th to 90th percentile range.
     *
     * @return AdsProjectedCohortValue
     */
    public function getProjected(): AdsProjectedCohortValue
    {
        return $this->projected;
    }
    /**
     * A projected ROAS and its 10th to 90th percentile range.
     *
     * @param AdsProjectedCohortValue $projected
     *
     * @return self
     */
    public function setProjected(AdsProjectedCohortValue $projected): self
    {
        $this->initialized['projected'] = true;
        $this->projected = $projected;
        return $this;
    }
    /**
     * Whether some of the cohort's people are still inside the day's window, so the value can grow.
     *
     * @return bool
     */
    public function getIsMaturing(): bool
    {
        return $this->isMaturing;
    }
    /**
     * Whether some of the cohort's people are still inside the day's window, so the value can grow.
     *
     * @param bool $isMaturing
     *
     * @return self
     */
    public function setIsMaturing(bool $isMaturing): self
    {
        $this->initialized['isMaturing'] = true;
        $this->isMaturing = $isMaturing;
        return $this;
    }
}