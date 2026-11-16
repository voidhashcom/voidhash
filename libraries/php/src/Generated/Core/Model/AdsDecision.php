<?php

namespace Voidhash\Generated\Core\Model;

class AdsDecision
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
     * What was decided: the object was `created`, or its `status`, `budget` or `bid_strategy` changed.
     *
     * @var string
     */
    protected $kind;
    /**
     * When it was made, as an ISO 8601 timestamp: the platform's creation or last-edit time when that falls between two syncs, else when the sync found it.
     *
     * @var string
     */
    protected $changedAt;
    /**
     * When the sync that found it ran, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $detectedAt;
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
     * The settings a decision is about: only those it changed, or all of them for a new object.
     *
     * @var AdsObjectSettings
     */
    protected $before;
    /**
     * The settings a decision is about: only those it changed, or all of them for a new object.
     *
     * @var AdsObjectSettings
     */
    protected $after;
    /**
     * What was decided: the object was `created`, or its `status`, `budget` or `bid_strategy` changed.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What was decided: the object was `created`, or its `status`, `budget` or `bid_strategy` changed.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * When it was made, as an ISO 8601 timestamp: the platform's creation or last-edit time when that falls between two syncs, else when the sync found it.
     *
     * @return string
     */
    public function getChangedAt(): string
    {
        return $this->changedAt;
    }
    /**
     * When it was made, as an ISO 8601 timestamp: the platform's creation or last-edit time when that falls between two syncs, else when the sync found it.
     *
     * @param string $changedAt
     *
     * @return self
     */
    public function setChangedAt(string $changedAt): self
    {
        $this->initialized['changedAt'] = true;
        $this->changedAt = $changedAt;
        return $this;
    }
    /**
     * When the sync that found it ran, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getDetectedAt(): string
    {
        return $this->detectedAt;
    }
    /**
     * When the sync that found it ran, as an ISO 8601 timestamp.
     *
     * @param string $detectedAt
     *
     * @return self
     */
    public function setDetectedAt(string $detectedAt): self
    {
        $this->initialized['detectedAt'] = true;
        $this->detectedAt = $detectedAt;
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
     * The settings a decision is about: only those it changed, or all of them for a new object.
     *
     * @return AdsObjectSettings
     */
    public function getBefore(): AdsObjectSettings
    {
        return $this->before;
    }
    /**
     * The settings a decision is about: only those it changed, or all of them for a new object.
     *
     * @param AdsObjectSettings $before
     *
     * @return self
     */
    public function setBefore(AdsObjectSettings $before): self
    {
        $this->initialized['before'] = true;
        $this->before = $before;
        return $this;
    }
    /**
     * The settings a decision is about: only those it changed, or all of them for a new object.
     *
     * @return AdsObjectSettings
     */
    public function getAfter(): AdsObjectSettings
    {
        return $this->after;
    }
    /**
     * The settings a decision is about: only those it changed, or all of them for a new object.
     *
     * @param AdsObjectSettings $after
     *
     * @return self
     */
    public function setAfter(AdsObjectSettings $after): self
    {
        $this->initialized['after'] = true;
        $this->after = $after;
        return $this;
    }
}