<?php

namespace Voidhash\Generated\Core\Model;

class AdsReportedMetrics
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
     * What was spent, in minor units of `currency`.
     *
     * @var int
     */
    protected $spend;
    /**
     * Times the ads were shown.
     *
     * @var int
     */
    protected $impressions;
    /**
     * Unique people reached; null unless the request `include`s `reach`. Never summed, so null in totals.
     *
     * @var int|null
     */
    protected $reach;
    /**
     * Average times each person saw the ads, `impressions / reach`; null with `reach`.
     *
     * @var float|null
     */
    protected $frequency;
    /**
     * Clicks on the ads' links.
     *
     * @var int
     */
    protected $linkClicks;
    /**
     * Link click-through rate, `linkClicks / impressions`, as a decimal.
     *
     * @var float|null
     */
    protected $ctr;
    /**
     * The purchase value the platform attributes, in minor units; null when it reported none.
     *
     * @var int|null
     */
    protected $purchaseValue;
    /**
     * The platform's return on ad spend, `purchaseValue / spend`.
     *
     * @var float|null
     */
    protected $platformRoas;
    /**
     * What the platform counted as results, by type. Results of different types are never added.
     *
     * @var list<AdsReportedMetricsResultsItem>
     */
    protected $results;
    /**
     * What was spent, in minor units of `currency`.
     *
     * @return int
     */
    public function getSpend(): int
    {
        return $this->spend;
    }
    /**
     * What was spent, in minor units of `currency`.
     *
     * @param int $spend
     *
     * @return self
     */
    public function setSpend(int $spend): self
    {
        $this->initialized['spend'] = true;
        $this->spend = $spend;
        return $this;
    }
    /**
     * Times the ads were shown.
     *
     * @return int
     */
    public function getImpressions(): int
    {
        return $this->impressions;
    }
    /**
     * Times the ads were shown.
     *
     * @param int $impressions
     *
     * @return self
     */
    public function setImpressions(int $impressions): self
    {
        $this->initialized['impressions'] = true;
        $this->impressions = $impressions;
        return $this;
    }
    /**
     * Unique people reached; null unless the request `include`s `reach`. Never summed, so null in totals.
     *
     * @return int|null
     */
    public function getReach(): ?int
    {
        return $this->reach;
    }
    /**
     * Unique people reached; null unless the request `include`s `reach`. Never summed, so null in totals.
     *
     * @param int|null $reach
     *
     * @return self
     */
    public function setReach(?int $reach): self
    {
        $this->initialized['reach'] = true;
        $this->reach = $reach;
        return $this;
    }
    /**
     * Average times each person saw the ads, `impressions / reach`; null with `reach`.
     *
     * @return float|null
     */
    public function getFrequency(): ?float
    {
        return $this->frequency;
    }
    /**
     * Average times each person saw the ads, `impressions / reach`; null with `reach`.
     *
     * @param float|null $frequency
     *
     * @return self
     */
    public function setFrequency(?float $frequency): self
    {
        $this->initialized['frequency'] = true;
        $this->frequency = $frequency;
        return $this;
    }
    /**
     * Clicks on the ads' links.
     *
     * @return int
     */
    public function getLinkClicks(): int
    {
        return $this->linkClicks;
    }
    /**
     * Clicks on the ads' links.
     *
     * @param int $linkClicks
     *
     * @return self
     */
    public function setLinkClicks(int $linkClicks): self
    {
        $this->initialized['linkClicks'] = true;
        $this->linkClicks = $linkClicks;
        return $this;
    }
    /**
     * Link click-through rate, `linkClicks / impressions`, as a decimal.
     *
     * @return float|null
     */
    public function getCtr(): ?float
    {
        return $this->ctr;
    }
    /**
     * Link click-through rate, `linkClicks / impressions`, as a decimal.
     *
     * @param float|null $ctr
     *
     * @return self
     */
    public function setCtr(?float $ctr): self
    {
        $this->initialized['ctr'] = true;
        $this->ctr = $ctr;
        return $this;
    }
    /**
     * The purchase value the platform attributes, in minor units; null when it reported none.
     *
     * @return int|null
     */
    public function getPurchaseValue(): ?int
    {
        return $this->purchaseValue;
    }
    /**
     * The purchase value the platform attributes, in minor units; null when it reported none.
     *
     * @param int|null $purchaseValue
     *
     * @return self
     */
    public function setPurchaseValue(?int $purchaseValue): self
    {
        $this->initialized['purchaseValue'] = true;
        $this->purchaseValue = $purchaseValue;
        return $this;
    }
    /**
     * The platform's return on ad spend, `purchaseValue / spend`.
     *
     * @return float|null
     */
    public function getPlatformRoas(): ?float
    {
        return $this->platformRoas;
    }
    /**
     * The platform's return on ad spend, `purchaseValue / spend`.
     *
     * @param float|null $platformRoas
     *
     * @return self
     */
    public function setPlatformRoas(?float $platformRoas): self
    {
        $this->initialized['platformRoas'] = true;
        $this->platformRoas = $platformRoas;
        return $this;
    }
    /**
     * What the platform counted as results, by type. Results of different types are never added.
     *
     * @return list<AdsReportedMetricsResultsItem>
     */
    public function getResults(): array
    {
        return $this->results;
    }
    /**
     * What the platform counted as results, by type. Results of different types are never added.
     *
     * @param list<AdsReportedMetricsResultsItem> $results
     *
     * @return self
     */
    public function setResults(array $results): self
    {
        $this->initialized['results'] = true;
        $this->results = $results;
        return $this;
    }
}