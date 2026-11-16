<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartHistogramResultBinsItem
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
     * The bin's lower bound, included.
     *
     * @var float
     */
    protected $lower;
    /**
     * The bin's upper bound, excluded; null for the last bin, which has none.
     *
     * @var float|null
     */
    protected $upper;
    /**
     * How many fall in the bin.
     *
     * @var float
     */
    protected $count;
    /**
     * The bin's lower bound, included.
     *
     * @return float
     */
    public function getLower(): float
    {
        return $this->lower;
    }
    /**
     * The bin's lower bound, included.
     *
     * @param float $lower
     *
     * @return self
     */
    public function setLower(float $lower): self
    {
        $this->initialized['lower'] = true;
        $this->lower = $lower;
        return $this;
    }
    /**
     * The bin's upper bound, excluded; null for the last bin, which has none.
     *
     * @return float|null
     */
    public function getUpper(): ?float
    {
        return $this->upper;
    }
    /**
     * The bin's upper bound, excluded; null for the last bin, which has none.
     *
     * @param float|null $upper
     *
     * @return self
     */
    public function setUpper(?float $upper): self
    {
        $this->initialized['upper'] = true;
        $this->upper = $upper;
        return $this;
    }
    /**
     * How many fall in the bin.
     *
     * @return float
     */
    public function getCount(): float
    {
        return $this->count;
    }
    /**
     * How many fall in the bin.
     *
     * @param float $count
     *
     * @return self
     */
    public function setCount(float $count): self
    {
        $this->initialized['count'] = true;
        $this->count = $count;
        return $this;
    }
}