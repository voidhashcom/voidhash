<?php

namespace Voidhash\Generated\Core\Model;

class AdsModeledMetrics
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
     * Measured net revenue plus what unseen clicks are estimated to have earned, in minor units.
     *
     * @var int
     */
    protected $netRevenueHigh;
    /**
     * The upper return on ad spend, `netRevenueHigh / spend`.
     *
     * @var float|null
     */
    protected $roasHigh;
    /**
     * The share of web-bound link clicks that came with a visit, row by row, at most 1.
     *
     * @var float
     */
    protected $visitCoverage;
    /**
     * Measured net revenue plus what unseen clicks are estimated to have earned, in minor units.
     *
     * @return int
     */
    public function getNetRevenueHigh(): int
    {
        return $this->netRevenueHigh;
    }
    /**
     * Measured net revenue plus what unseen clicks are estimated to have earned, in minor units.
     *
     * @param int $netRevenueHigh
     *
     * @return self
     */
    public function setNetRevenueHigh(int $netRevenueHigh): self
    {
        $this->initialized['netRevenueHigh'] = true;
        $this->netRevenueHigh = $netRevenueHigh;
        return $this;
    }
    /**
     * The upper return on ad spend, `netRevenueHigh / spend`.
     *
     * @return float|null
     */
    public function getRoasHigh(): ?float
    {
        return $this->roasHigh;
    }
    /**
     * The upper return on ad spend, `netRevenueHigh / spend`.
     *
     * @param float|null $roasHigh
     *
     * @return self
     */
    public function setRoasHigh(?float $roasHigh): self
    {
        $this->initialized['roasHigh'] = true;
        $this->roasHigh = $roasHigh;
        return $this;
    }
    /**
     * The share of web-bound link clicks that came with a visit, row by row, at most 1.
     *
     * @return float
     */
    public function getVisitCoverage(): float
    {
        return $this->visitCoverage;
    }
    /**
     * The share of web-bound link clicks that came with a visit, row by row, at most 1.
     *
     * @param float $visitCoverage
     *
     * @return self
     */
    public function setVisitCoverage(float $visitCoverage): self
    {
        $this->initialized['visitCoverage'] = true;
        $this->visitCoverage = $visitCoverage;
        return $this;
    }
}