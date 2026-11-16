<?php

namespace Voidhash\Generated\Core\Model;

class AdsProjectedCohortValue
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
     * The projected ROAS, the median.
     *
     * @var float
     */
    protected $value;
    /**
     * The 10th percentile of the projection.
     *
     * @var float
     */
    protected $low;
    /**
     * The 90th percentile of the projection.
     *
     * @var float
     */
    protected $high;
    /**
     * Whether some renewals or trials could not be projected yet, so the projection is likely low.
     *
     * @var bool
     */
    protected $isPartial;
    /**
     * The projected ROAS, the median.
     *
     * @return float
     */
    public function getValue(): float
    {
        return $this->value;
    }
    /**
     * The projected ROAS, the median.
     *
     * @param float $value
     *
     * @return self
     */
    public function setValue(float $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
    /**
     * The 10th percentile of the projection.
     *
     * @return float
     */
    public function getLow(): float
    {
        return $this->low;
    }
    /**
     * The 10th percentile of the projection.
     *
     * @param float $low
     *
     * @return self
     */
    public function setLow(float $low): self
    {
        $this->initialized['low'] = true;
        $this->low = $low;
        return $this;
    }
    /**
     * The 90th percentile of the projection.
     *
     * @return float
     */
    public function getHigh(): float
    {
        return $this->high;
    }
    /**
     * The 90th percentile of the projection.
     *
     * @param float $high
     *
     * @return self
     */
    public function setHigh(float $high): self
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