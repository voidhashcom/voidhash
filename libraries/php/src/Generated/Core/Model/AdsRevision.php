<?php

namespace Voidhash\Generated\Core\Model;

class AdsRevision
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
     * When the sync read the numbers, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $readAt;
    /**
     * The day corrected, `YYYY-MM-DD` in the account's time zone.
     *
     * @var string
     */
    protected $date;
    /**
     * The connected ad account of the object, `ad_acct_...`.
     *
     * @var string
     */
    protected $adAccountId;
    /**
     * The level of the ad hierarchy: `campaign`, `ad_group` (Meta: ad set) or `ad`.
     *
     * @var string
     */
    protected $level;
    /**
     * The platform's id of the object.
     *
     * @var string
     */
    protected $id;
    /**
     * The object's name on the platform.
     *
     * @var string
     */
    protected $name;
    /**
     * The platform's id of its campaign, or its own for a campaign.
     *
     * @var string
     */
    protected $campaignId;
    /**
     * The platform's id of its ad group, or its own for an ad group; null for campaigns.
     *
     * @var string|null
     */
    protected $adGroupId;
    /**
     * ISO 4217 code of the amounts, the ad account's.
     *
     * @var string
     */
    protected $currency;
    /**
     * Change in spend, in minor units of `currency`; negative where lowered.
     *
     * @var int
     */
    protected $spend;
    /**
     * Change in impressions.
     *
     * @var int
     */
    protected $impressions;
    /**
     * Change in clicks of every kind, including likes and profile clicks.
     *
     * @var int
     */
    protected $clicks;
    /**
     * Change in link clicks.
     *
     * @var int
     */
    protected $linkClicks;
    /**
     * Change in results, by type. Results of different types are never added.
     *
     * @var list<AdsResultChange>
     */
    protected $results;
    /**
     * Change in conversions, by kind.
     *
     * @var list<AdsConversionChange>
     */
    protected $conversions;
    /**
     * When the sync read the numbers, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getReadAt(): string
    {
        return $this->readAt;
    }
    /**
     * When the sync read the numbers, as an ISO 8601 timestamp.
     *
     * @param string $readAt
     *
     * @return self
     */
    public function setReadAt(string $readAt): self
    {
        $this->initialized['readAt'] = true;
        $this->readAt = $readAt;
        return $this;
    }
    /**
     * The day corrected, `YYYY-MM-DD` in the account's time zone.
     *
     * @return string
     */
    public function getDate(): string
    {
        return $this->date;
    }
    /**
     * The day corrected, `YYYY-MM-DD` in the account's time zone.
     *
     * @param string $date
     *
     * @return self
     */
    public function setDate(string $date): self
    {
        $this->initialized['date'] = true;
        $this->date = $date;
        return $this;
    }
    /**
     * The connected ad account of the object, `ad_acct_...`.
     *
     * @return string
     */
    public function getAdAccountId(): string
    {
        return $this->adAccountId;
    }
    /**
     * The connected ad account of the object, `ad_acct_...`.
     *
     * @param string $adAccountId
     *
     * @return self
     */
    public function setAdAccountId(string $adAccountId): self
    {
        $this->initialized['adAccountId'] = true;
        $this->adAccountId = $adAccountId;
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
     * The platform's id of the object.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The platform's id of the object.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The object's name on the platform.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The object's name on the platform.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The platform's id of its campaign, or its own for a campaign.
     *
     * @return string
     */
    public function getCampaignId(): string
    {
        return $this->campaignId;
    }
    /**
     * The platform's id of its campaign, or its own for a campaign.
     *
     * @param string $campaignId
     *
     * @return self
     */
    public function setCampaignId(string $campaignId): self
    {
        $this->initialized['campaignId'] = true;
        $this->campaignId = $campaignId;
        return $this;
    }
    /**
     * The platform's id of its ad group, or its own for an ad group; null for campaigns.
     *
     * @return string|null
     */
    public function getAdGroupId(): ?string
    {
        return $this->adGroupId;
    }
    /**
     * The platform's id of its ad group, or its own for an ad group; null for campaigns.
     *
     * @param string|null $adGroupId
     *
     * @return self
     */
    public function setAdGroupId(?string $adGroupId): self
    {
        $this->initialized['adGroupId'] = true;
        $this->adGroupId = $adGroupId;
        return $this;
    }
    /**
     * ISO 4217 code of the amounts, the ad account's.
     *
     * @return string
     */
    public function getCurrency(): string
    {
        return $this->currency;
    }
    /**
     * ISO 4217 code of the amounts, the ad account's.
     *
     * @param string $currency
     *
     * @return self
     */
    public function setCurrency(string $currency): self
    {
        $this->initialized['currency'] = true;
        $this->currency = $currency;
        return $this;
    }
    /**
     * Change in spend, in minor units of `currency`; negative where lowered.
     *
     * @return int
     */
    public function getSpend(): int
    {
        return $this->spend;
    }
    /**
     * Change in spend, in minor units of `currency`; negative where lowered.
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
     * Change in impressions.
     *
     * @return int
     */
    public function getImpressions(): int
    {
        return $this->impressions;
    }
    /**
     * Change in impressions.
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
     * Change in clicks of every kind, including likes and profile clicks.
     *
     * @return int
     */
    public function getClicks(): int
    {
        return $this->clicks;
    }
    /**
     * Change in clicks of every kind, including likes and profile clicks.
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
     * Change in link clicks.
     *
     * @return int
     */
    public function getLinkClicks(): int
    {
        return $this->linkClicks;
    }
    /**
     * Change in link clicks.
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
     * Change in results, by type. Results of different types are never added.
     *
     * @return list<AdsResultChange>
     */
    public function getResults(): array
    {
        return $this->results;
    }
    /**
     * Change in results, by type. Results of different types are never added.
     *
     * @param list<AdsResultChange> $results
     *
     * @return self
     */
    public function setResults(array $results): self
    {
        $this->initialized['results'] = true;
        $this->results = $results;
        return $this;
    }
    /**
     * Change in conversions, by kind.
     *
     * @return list<AdsConversionChange>
     */
    public function getConversions(): array
    {
        return $this->conversions;
    }
    /**
     * Change in conversions, by kind.
     *
     * @param list<AdsConversionChange> $conversions
     *
     * @return self
     */
    public function setConversions(array $conversions): self
    {
        $this->initialized['conversions'] = true;
        $this->conversions = $conversions;
        return $this;
    }
}