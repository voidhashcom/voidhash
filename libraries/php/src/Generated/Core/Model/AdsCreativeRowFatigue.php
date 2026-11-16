<?php

namespace Voidhash\Generated\Core\Model;

class AdsCreativeRowFatigue
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
     * Frequency over the range.
     *
     * @var float
     */
    protected $frequency;
    /**
     * Relative change of link CTR from the first to the last active day, such as `-0.3`.
     *
     * @var float
     */
    protected $ctrChange;
    /**
     * Active days the change spans.
     *
     * @var int
     */
    protected $days;
    /**
     * Frequency over the range.
     *
     * @return float
     */
    public function getFrequency(): float
    {
        return $this->frequency;
    }
    /**
     * Frequency over the range.
     *
     * @param float $frequency
     *
     * @return self
     */
    public function setFrequency(float $frequency): self
    {
        $this->initialized['frequency'] = true;
        $this->frequency = $frequency;
        return $this;
    }
    /**
     * Relative change of link CTR from the first to the last active day, such as `-0.3`.
     *
     * @return float
     */
    public function getCtrChange(): float
    {
        return $this->ctrChange;
    }
    /**
     * Relative change of link CTR from the first to the last active day, such as `-0.3`.
     *
     * @param float $ctrChange
     *
     * @return self
     */
    public function setCtrChange(float $ctrChange): self
    {
        $this->initialized['ctrChange'] = true;
        $this->ctrChange = $ctrChange;
        return $this;
    }
    /**
     * Active days the change spans.
     *
     * @return int
     */
    public function getDays(): int
    {
        return $this->days;
    }
    /**
     * Active days the change spans.
     *
     * @param int $days
     *
     * @return self
     */
    public function setDays(int $days): self
    {
        $this->initialized['days'] = true;
        $this->days = $days;
        return $this;
    }
}