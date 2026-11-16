<?php

namespace Voidhash\Generated\Core\Model;

class AdsPerformanceRowBreakdownItem
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
     * The slice's value of the dimension, such as `CZ`, `25-34` or `ios`.
     *
     * @var string
     */
    protected $value;
    /**
     * Numbers the ad platform reports, with its own attribution.
     *
     * @var AdsReportedMetrics
     */
    protected $reported;
    /**
     * Numbers Voidhash measures from the people whose signup was credited to a touch from the row. A step the project or the destination does not have is null: a website campaign has no installs.
     *
     * @var AdsMeasuredMetrics
     */
    protected $measured;
    /**
     * The slice's value of the dimension, such as `CZ`, `25-34` or `ios`.
     *
     * @return string
     */
    public function getValue(): string
    {
        return $this->value;
    }
    /**
     * The slice's value of the dimension, such as `CZ`, `25-34` or `ios`.
     *
     * @param string $value
     *
     * @return self
     */
    public function setValue(string $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
    /**
     * Numbers the ad platform reports, with its own attribution.
     *
     * @return AdsReportedMetrics
     */
    public function getReported(): AdsReportedMetrics
    {
        return $this->reported;
    }
    /**
     * Numbers the ad platform reports, with its own attribution.
     *
     * @param AdsReportedMetrics $reported
     *
     * @return self
     */
    public function setReported(AdsReportedMetrics $reported): self
    {
        $this->initialized['reported'] = true;
        $this->reported = $reported;
        return $this;
    }
    /**
     * Numbers Voidhash measures from the people whose signup was credited to a touch from the row. A step the project or the destination does not have is null: a website campaign has no installs.
     *
     * @return AdsMeasuredMetrics
     */
    public function getMeasured(): AdsMeasuredMetrics
    {
        return $this->measured;
    }
    /**
     * Numbers Voidhash measures from the people whose signup was credited to a touch from the row. A step the project or the destination does not have is null: a website campaign has no installs.
     *
     * @param AdsMeasuredMetrics $measured
     *
     * @return self
     */
    public function setMeasured(AdsMeasuredMetrics $measured): self
    {
        $this->initialized['measured'] = true;
        $this->measured = $measured;
        return $this;
    }
}