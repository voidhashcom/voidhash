<?php

namespace Voidhash\Generated\Core\Model;

class AdsPerformanceReportJsonEncodingUnallocated
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
     * Spend no ad accounts for, in minor units.
     *
     * @var int
     */
    protected $spend;
    /**
     * Impressions no ad accounts for.
     *
     * @var int
     */
    protected $impressions;
    /**
     * Every click no ad accounts for, including likes and profile clicks.
     *
     * @var int
     */
    protected $clicks;
    /**
     * Link clicks no ad accounts for; null when some days were synced before link clicks were read.
     *
     * @var int|null
     */
    protected $linkClicks;
    /**
     * Spend no ad accounts for, in minor units.
     *
     * @return int
     */
    public function getSpend(): int
    {
        return $this->spend;
    }
    /**
     * Spend no ad accounts for, in minor units.
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
     * Impressions no ad accounts for.
     *
     * @return int
     */
    public function getImpressions(): int
    {
        return $this->impressions;
    }
    /**
     * Impressions no ad accounts for.
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
     * Every click no ad accounts for, including likes and profile clicks.
     *
     * @return int
     */
    public function getClicks(): int
    {
        return $this->clicks;
    }
    /**
     * Every click no ad accounts for, including likes and profile clicks.
     *
     * @param int $clicks
     *
     * @return self
     */
    public function setClicks(int $clicks): self
    {
        $this->initialized['clicks'] = true;
        $this->clicks = $clicks;
        return $this;
    }
    /**
     * Link clicks no ad accounts for; null when some days were synced before link clicks were read.
     *
     * @return int|null
     */
    public function getLinkClicks(): ?int
    {
        return $this->linkClicks;
    }
    /**
     * Link clicks no ad accounts for; null when some days were synced before link clicks were read.
     *
     * @param int|null $linkClicks
     *
     * @return self
     */
    public function setLinkClicks(?int $linkClicks): self
    {
        $this->initialized['linkClicks'] = true;
        $this->linkClicks = $linkClicks;
        return $this;
    }
}