<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionReportResultJsonEncodingCoverage
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
     * Gross revenue of people whose signup was credited to a touch, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $attributedRevenue;
    /**
     * The project's gross revenue between `start` and `revenueEnd`, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $totalRevenue;
    /**
     * `attributedRevenue / totalRevenue`, from 0 to 1; null without revenue.
     *
     * @var float|null
     */
    protected $share;
    /**
     * The project's net revenue between `start` and `revenueEnd`, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $netRevenue;
    /**
     * Net revenue by the touch credited with each person's signup: `paid` per network, `organic`, or `none` per `reason`.
     *
     * @var list<AcquisitionReportResultJsonEncodingCoverageClassesItem>
     */
    protected $classes;
    /**
     * Gross revenue of people whose signup was credited to a touch, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getAttributedRevenue(): int
    {
        return $this->attributedRevenue;
    }
    /**
     * Gross revenue of people whose signup was credited to a touch, in integer minor units of the report currency, such as cents.
     *
     * @param int $attributedRevenue
     *
     * @return self
     */
    public function setAttributedRevenue(int $attributedRevenue): self
    {
        $this->initialized['attributedRevenue'] = true;
        $this->attributedRevenue = $attributedRevenue;
        return $this;
    }
    /**
     * The project's gross revenue between `start` and `revenueEnd`, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getTotalRevenue(): int
    {
        return $this->totalRevenue;
    }
    /**
     * The project's gross revenue between `start` and `revenueEnd`, in integer minor units of the report currency, such as cents.
     *
     * @param int $totalRevenue
     *
     * @return self
     */
    public function setTotalRevenue(int $totalRevenue): self
    {
        $this->initialized['totalRevenue'] = true;
        $this->totalRevenue = $totalRevenue;
        return $this;
    }
    /**
     * `attributedRevenue / totalRevenue`, from 0 to 1; null without revenue.
     *
     * @return float|null
     */
    public function getShare(): ?float
    {
        return $this->share;
    }
    /**
     * `attributedRevenue / totalRevenue`, from 0 to 1; null without revenue.
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
    /**
     * The project's net revenue between `start` and `revenueEnd`, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getNetRevenue(): int
    {
        return $this->netRevenue;
    }
    /**
     * The project's net revenue between `start` and `revenueEnd`, in integer minor units of the report currency, such as cents.
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
     * Net revenue by the touch credited with each person's signup: `paid` per network, `organic`, or `none` per `reason`.
     *
     * @return list<AcquisitionReportResultJsonEncodingCoverageClassesItem>
     */
    public function getClasses(): array
    {
        return $this->classes;
    }
    /**
     * Net revenue by the touch credited with each person's signup: `paid` per network, `organic`, or `none` per `reason`.
     *
     * @param list<AcquisitionReportResultJsonEncodingCoverageClassesItem> $classes
     *
     * @return self
     */
    public function setClasses(array $classes): self
    {
        $this->initialized['classes'] = true;
        $this->classes = $classes;
        return $this;
    }
}