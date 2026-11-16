<?php

namespace Voidhash\Generated\Core\Model;

class AdsChangesReportBodyJsonEncoding
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
     * Start of the period, inclusive, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $since;
    /**
     * End of the period, exclusive, as an ISO 8601 timestamp; defaults to now. A report spans at most 7 days.
     *
     * @var string|null
     */
    protected $until;
    /**
     * The level of the ad hierarchy: `campaign`, `ad_group` (Meta: ad set) or `ad`.
     *
     * @var string
     */
    protected $level;
    /**
     * Only these campaigns, or the ad groups and ads in them, by the platform's ids. At most 100.
     *
     * @var list<string>|null
     */
    protected $campaignIds;
    /**
     * Start of the period, inclusive, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getSince(): string
    {
        return $this->since;
    }
    /**
     * Start of the period, inclusive, as an ISO 8601 timestamp.
     *
     * @param string $since
     *
     * @return self
     */
    public function setSince(string $since): self
    {
        $this->initialized['since'] = true;
        $this->since = $since;
        return $this;
    }
    /**
     * End of the period, exclusive, as an ISO 8601 timestamp; defaults to now. A report spans at most 7 days.
     *
     * @return string|null
     */
    public function getUntil(): ?string
    {
        return $this->until;
    }
    /**
     * End of the period, exclusive, as an ISO 8601 timestamp; defaults to now. A report spans at most 7 days.
     *
     * @param string|null $until
     *
     * @return self
     */
    public function setUntil(?string $until): self
    {
        $this->initialized['until'] = true;
        $this->until = $until;
        return $this;
    }
    /**
     * The level of the ad hierarchy: `campaign`, `ad_group` (Meta: ad set) or `ad`.
     *
     * @return string
     */
    public function getLevel(): string
    {
        return $this->level;
    }
    /**
     * The level of the ad hierarchy: `campaign`, `ad_group` (Meta: ad set) or `ad`.
     *
     * @param string $level
     *
     * @return self
     */
    public function setLevel(string $level): self
    {
        $this->initialized['level'] = true;
        $this->level = $level;
        return $this;
    }
    /**
     * Only these campaigns, or the ad groups and ads in them, by the platform's ids. At most 100.
     *
     * @return list<string>|null
     */
    public function getCampaignIds(): ?array
    {
        return $this->campaignIds;
    }
    /**
     * Only these campaigns, or the ad groups and ads in them, by the platform's ids. At most 100.
     *
     * @param list<string>|null $campaignIds
     *
     * @return self
     */
    public function setCampaignIds(?array $campaignIds): self
    {
        $this->initialized['campaignIds'] = true;
        $this->campaignIds = $campaignIds;
        return $this;
    }
}