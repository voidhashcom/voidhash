<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionCohortsResultJsonEncodingGroupsItem
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
     * The credited touch's ad network, such as `meta`, `google` or the lowercased `utm_source`; null for a touch without one, such as a newsletter link, and at `surface` level.
     *
     * @var string|null
     */
    protected $network;
    /**
     * The ad platform's campaign id; null above `campaign` level or when the touch had none.
     *
     * @var string|null
     */
    protected $campaignId;
    /**
     * The campaign's latest name, or `utm_campaign` when the id is missing.
     *
     * @var string|null
     */
    protected $campaignName;
    /**
     * The ad platform's ad set id; null above `adset` level or when the touch had none.
     *
     * @var string|null
     */
    protected $adsetId;
    /**
     * The ad set's latest name, or `utm_term` when the id is missing.
     *
     * @var string|null
     */
    protected $adsetName;
    /**
     * The ad platform's ad id; null above `ad` level or when the touch had none.
     *
     * @var string|null
     */
    protected $adId;
    /**
     * The ad's latest name, or `utm_content` when the id is missing.
     *
     * @var string|null
     */
    protected $adName;
    /**
     * At `surface` level, `cross_surface` for people whose journey crossed surfaces, else the surface they signed up on; null at the other levels.
     *
     * @var string|null
     */
    protected $surface;
    /**
     * The group's weekly cohorts, oldest first.
     *
     * @var list<AcquisitionCohort>
     */
    protected $cohorts;
    /**
     * The credited touch's ad network, such as `meta`, `google` or the lowercased `utm_source`; null for a touch without one, such as a newsletter link, and at `surface` level.
     *
     * @return string|null
     */
    public function getNetwork(): ?string
    {
        return $this->network;
    }
    /**
     * The credited touch's ad network, such as `meta`, `google` or the lowercased `utm_source`; null for a touch without one, such as a newsletter link, and at `surface` level.
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
     * The ad platform's campaign id; null above `campaign` level or when the touch had none.
     *
     * @return string|null
     */
    public function getCampaignId(): ?string
    {
        return $this->campaignId;
    }
    /**
     * The ad platform's campaign id; null above `campaign` level or when the touch had none.
     *
     * @param string|null $campaignId
     *
     * @return self
     */
    public function setCampaignId(?string $campaignId): self
    {
        $this->initialized['campaignId'] = true;
        $this->campaignId = $campaignId;
        return $this;
    }
    /**
     * The campaign's latest name, or `utm_campaign` when the id is missing.
     *
     * @return string|null
     */
    public function getCampaignName(): ?string
    {
        return $this->campaignName;
    }
    /**
     * The campaign's latest name, or `utm_campaign` when the id is missing.
     *
     * @param string|null $campaignName
     *
     * @return self
     */
    public function setCampaignName(?string $campaignName): self
    {
        $this->initialized['campaignName'] = true;
        $this->campaignName = $campaignName;
        return $this;
    }
    /**
     * The ad platform's ad set id; null above `adset` level or when the touch had none.
     *
     * @return string|null
     */
    public function getAdsetId(): ?string
    {
        return $this->adsetId;
    }
    /**
     * The ad platform's ad set id; null above `adset` level or when the touch had none.
     *
     * @param string|null $adsetId
     *
     * @return self
     */
    public function setAdsetId(?string $adsetId): self
    {
        $this->initialized['adsetId'] = true;
        $this->adsetId = $adsetId;
        return $this;
    }
    /**
     * The ad set's latest name, or `utm_term` when the id is missing.
     *
     * @return string|null
     */
    public function getAdsetName(): ?string
    {
        return $this->adsetName;
    }
    /**
     * The ad set's latest name, or `utm_term` when the id is missing.
     *
     * @param string|null $adsetName
     *
     * @return self
     */
    public function setAdsetName(?string $adsetName): self
    {
        $this->initialized['adsetName'] = true;
        $this->adsetName = $adsetName;
        return $this;
    }
    /**
     * The ad platform's ad id; null above `ad` level or when the touch had none.
     *
     * @return string|null
     */
    public function getAdId(): ?string
    {
        return $this->adId;
    }
    /**
     * The ad platform's ad id; null above `ad` level or when the touch had none.
     *
     * @param string|null $adId
     *
     * @return self
     */
    public function setAdId(?string $adId): self
    {
        $this->initialized['adId'] = true;
        $this->adId = $adId;
        return $this;
    }
    /**
     * The ad's latest name, or `utm_content` when the id is missing.
     *
     * @return string|null
     */
    public function getAdName(): ?string
    {
        return $this->adName;
    }
    /**
     * The ad's latest name, or `utm_content` when the id is missing.
     *
     * @param string|null $adName
     *
     * @return self
     */
    public function setAdName(?string $adName): self
    {
        $this->initialized['adName'] = true;
        $this->adName = $adName;
        return $this;
    }
    /**
     * At `surface` level, `cross_surface` for people whose journey crossed surfaces, else the surface they signed up on; null at the other levels.
     *
     * @return string|null
     */
    public function getSurface(): ?string
    {
        return $this->surface;
    }
    /**
     * At `surface` level, `cross_surface` for people whose journey crossed surfaces, else the surface they signed up on; null at the other levels.
     *
     * @param string|null $surface
     *
     * @return self
     */
    public function setSurface(?string $surface): self
    {
        $this->initialized['surface'] = true;
        $this->surface = $surface;
        return $this;
    }
    /**
     * The group's weekly cohorts, oldest first.
     *
     * @return list<AcquisitionCohort>
     */
    public function getCohorts(): array
    {
        return $this->cohorts;
    }
    /**
     * The group's weekly cohorts, oldest first.
     *
     * @param list<AcquisitionCohort> $cohorts
     *
     * @return self
     */
    public function setCohorts(array $cohorts): self
    {
        $this->initialized['cohorts'] = true;
        $this->cohorts = $cohorts;
        return $this;
    }
}