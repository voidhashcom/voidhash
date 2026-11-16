<?php

namespace Voidhash\Generated\Core\Model;

class AdsPerformanceReportJsonEncodingTotals
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
     * An upper estimate of revenue, not a measurement: it assumes the web-bound link clicks Voidhash could not see converted like the ones it could. Each level is estimated on its own, and across a level the estimates add up to no more than the net revenue of people with no credited touch. The range's floor is `measured`.
     *
     * @var AdsModeledMetrics
     */
    protected $modeled;
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
    /**
     * An upper estimate of revenue, not a measurement: it assumes the web-bound link clicks Voidhash could not see converted like the ones it could. Each level is estimated on its own, and across a level the estimates add up to no more than the net revenue of people with no credited touch. The range's floor is `measured`.
     *
     * @return AdsModeledMetrics
     */
    public function getModeled(): AdsModeledMetrics
    {
        return $this->modeled;
    }
    /**
     * An upper estimate of revenue, not a measurement: it assumes the web-bound link clicks Voidhash could not see converted like the ones it could. Each level is estimated on its own, and across a level the estimates add up to no more than the net revenue of people with no credited touch. The range's floor is `measured`.
     *
     * @param AdsModeledMetrics $modeled
     *
     * @return self
     */
    public function setModeled(AdsModeledMetrics $modeled): self
    {
        $this->initialized['modeled'] = true;
        $this->modeled = $modeled;
        return $this;
    }
}