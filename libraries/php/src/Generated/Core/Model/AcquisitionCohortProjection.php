<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionCohortProjection
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
     * Days after each person's touch.
     *
     * @var int
     */
    protected $day;
    /**
     * The net revenue expected by the end of the day, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $netRevenue;
    /**
     * The 10th percentile of `netRevenue`.
     *
     * @var int
     */
    protected $low;
    /**
     * The 90th percentile of `netRevenue`.
     *
     * @var int
     */
    protected $high;
    /**
     * Whether some renewals or trials could not be projected yet, so the projection is likely low.
     *
     * @var bool
     */
    protected $isPartial;
    /**
     * Days after each person's touch.
     *
     * @return int
     */
    public function getDay(): int
    {
        return $this->day;
    }
    /**
     * Days after each person's touch.
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
     * The net revenue expected by the end of the day, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getNetRevenue(): int
    {
        return $this->netRevenue;
    }
    /**
     * The net revenue expected by the end of the day, in integer minor units of the report currency, such as cents.
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
     * The 10th percentile of `netRevenue`.
     *
     * @return int
     */
    public function getLow(): int
    {
        return $this->low;
    }
    /**
     * The 10th percentile of `netRevenue`.
     *
     * @param int $low
     *
     * @return self
     */
    public function setLow(int $low): self
    {
        $this->initialized['low'] = true;
        $this->low = $low;
        return $this;
    }
    /**
     * The 90th percentile of `netRevenue`.
     *
     * @return int
     */
    public function getHigh(): int
    {
        return $this->high;
    }
    /**
     * The 90th percentile of `netRevenue`.
     *
     * @param int $high
     *
     * @return self
     */
    public function setHigh(int $high): self
    {
        $this->initialized['high'] = true;
        $this->high = $high;
        return $this;
    }
    /**
     * Whether some renewals or trials could not be projected yet, so the projection is likely low.
     *
     * @return bool
     */
    public function getIsPartial(): bool
    {
        return $this->isPartial;
    }
    /**
     * Whether some renewals or trials could not be projected yet, so the projection is likely low.
     *
     * @param bool $isPartial
     *
     * @return self
     */
    public function setIsPartial(bool $isPartial): self
    {
        $this->initialized['isPartial'] = true;
        $this->isPartial = $isPartial;
        return $this;
    }
}