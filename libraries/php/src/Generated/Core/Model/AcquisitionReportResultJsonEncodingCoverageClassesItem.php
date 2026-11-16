<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionReportResultJsonEncodingCoverageClassesItem
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
     * `paid` for a credited touch from an ad network, `organic` for any other tracked link, `none` without a credited touch.
     *
     * @var string
     */
    protected $class;
    /**
     * The ad network of `paid` revenue; null for the other classes.
     *
     * @var string|null
     */
    protected $network;
    /**
     * Why revenue of class `none` has no credited touch: `no_touch` for a person without any touch, `outside_window` for a person whose touches earned no credit, `no_person` for revenue with no person. Null for the other classes.
     *
     * @var string|null
     */
    protected $reason;
    /**
     * The class's net revenue, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $netRevenue;
    /**
     * The class's share of `netRevenue`, from 0 to 1; null without revenue.
     *
     * @var float|null
     */
    protected $share;
    /**
     * `paid` for a credited touch from an ad network, `organic` for any other tracked link, `none` without a credited touch.
     *
     * @return string
     */
    public function getClass(): string
    {
        return $this->class;
    }
    /**
     * `paid` for a credited touch from an ad network, `organic` for any other tracked link, `none` without a credited touch.
     *
     * @param string $class
     *
     * @return self
     */
    public function setClass(string $class): self
    {
        $this->initialized['class'] = true;
        $this->class = $class;
        return $this;
    }
    /**
     * The ad network of `paid` revenue; null for the other classes.
     *
     * @return string|null
     */
    public function getNetwork(): ?string
    {
        return $this->network;
    }
    /**
     * The ad network of `paid` revenue; null for the other classes.
     *
     * @param string|null $network
     *
     * @return self
     */
    public function setNetwork(?string $network): self
    {
        $this->initialized['network'] = true;
        $this->network = $network;
        return $this;
    }
    /**
     * Why revenue of class `none` has no credited touch: `no_touch` for a person without any touch, `outside_window` for a person whose touches earned no credit, `no_person` for revenue with no person. Null for the other classes.
     *
     * @return string|null
     */
    public function getReason(): ?string
    {
        return $this->reason;
    }
    /**
     * Why revenue of class `none` has no credited touch: `no_touch` for a person without any touch, `outside_window` for a person whose touches earned no credit, `no_person` for revenue with no person. Null for the other classes.
     *
     * @param string|null $reason
     *
     * @return self
     */
    public function setReason(?string $reason): self
    {
        $this->initialized['reason'] = true;
        $this->reason = $reason;
        return $this;
    }
    /**
     * The class's net revenue, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getNetRevenue(): int
    {
        return $this->netRevenue;
    }
    /**
     * The class's net revenue, in integer minor units of the report currency, such as cents.
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
     * The class's share of `netRevenue`, from 0 to 1; null without revenue.
     *
     * @return float|null
     */
    public function getShare(): ?float
    {
        return $this->share;
    }
    /**
     * The class's share of `netRevenue`, from 0 to 1; null without revenue.
     *
     * @param float|null $share
     *
     * @return self
     */
    public function setShare(?float $share): self
    {
        $this->initialized['share'] = true;
        $this->share = $share;
        return $this;
    }
}