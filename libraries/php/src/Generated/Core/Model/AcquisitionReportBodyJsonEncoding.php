<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionReportBodyJsonEncoding
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
     * Only people whose credited touch carried this ad id.
     *
     * @var string|null
     */
    protected $adId;
    /**
     * Only people whose credited touch carried this ad set id.
     *
     * @var string|null
     */
    protected $adsetId;
    /**
     * How many days, 1 to 90, before a signup a touch can be credited with it. Defaults to the project's attribution window.
     *
     * @var int|null
     */
    protected $attributionWindowDays;
    /**
     * Only people whose credited touch carried this campaign id.
     *
     * @var string|null
     */
    protected $campaignId;
    /**
     * The ISO 4217 code money is reported in. Amounts in another currency are converted at each day's exchange rate. Defaults to `USD`.
     *
     * @var string|null
     */
    protected $currency;
    /**
     * The environment whose revenue counts: `production` (the default), `sandbox` or `test`. Visits come from production keys, or from test keys for `test`; signups count in every environment.
     *
     * @var string|null
     */
    protected $environment;
    /**
     * The first acquisition day, `YYYY-MM-DD`, in the report time zone.
     *
     * @var string
     */
    protected $from;
    /**
     * Whether every row also carries `days`, its outcomes per acquisition day.
     *
     * @var bool|null
     */
    protected $hasDailyRows;
    /**
     * Whether every row also carries `signupSurfaces` and `paymentSurfaces`, its outcomes by signup and payment surface.
     *
     * @var bool|null
     */
    protected $hasSurfaceBreakdown;
    /**
     * The conversion ad cost is measured against: `signup`, `trial` or `payer`. Omitted or null uses the project's setting.
     *
     * @var string|null
     */
    protected $keyConversion;
    /**
     * What rows group by: the credited touch's `network`, `campaign`, `adset` or `ad`, or `surface`, where people group by the surface they signed up on, or `cross_surface`.
     *
     * @var string
     */
    protected $level;
    /**
     * Only people whose credited touch came from this ad network, such as `meta` or `google`. Compared in lowercase.
     *
     * @var string|null
     */
    protected $network;
    /**
     * Which revenue, signups and installs count: the first `days` after each person's acquisition, or everything up to the end of the `until` day. Defaults to everything up to now, so recent people have had less time to pay.
     *
     * @var mixed|null
     */
    protected $revenueWindow;
    /**
     * The IANA time zone that sets day boundaries, such as the ad account's. Offsets such as `+01:00` are rejected. Defaults to `UTC`.
     *
     * @var string|null
     */
    protected $timezone;
    /**
     * The last acquisition day, inclusive, `YYYY-MM-DD`. The range spans at most 366 days.
     *
     * @var string
     */
    protected $to;
    /**
     * Only people whose credited touch carried this ad id.
     *
     * @return string|null
     */
    public function getAdId(): ?string
    {
        return $this->adId;
    }
    /**
     * Only people whose credited touch carried this ad id.
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
     * Only people whose credited touch carried this ad set id.
     *
     * @return string|null
     */
    public function getAdsetId(): ?string
    {
        return $this->adsetId;
    }
    /**
     * Only people whose credited touch carried this ad set id.
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
     * How many days, 1 to 90, before a signup a touch can be credited with it. Defaults to the project's attribution window.
     *
     * @return int|null
     */
    public function getAttributionWindowDays(): ?int
    {
        return $this->attributionWindowDays;
    }
    /**
     * How many days, 1 to 90, before a signup a touch can be credited with it. Defaults to the project's attribution window.
     *
     * @param int|null $attributionWindowDays
     *
     * @return self
     */
    public function setAttributionWindowDays(?int $attributionWindowDays): self
    {
        $this->initialized['attributionWindowDays'] = true;
        $this->attributionWindowDays = $attributionWindowDays;
        return $this;
    }
    /**
     * Only people whose credited touch carried this campaign id.
     *
     * @return string|null
     */
    public function getCampaignId(): ?string
    {
        return $this->campaignId;
    }
    /**
     * Only people whose credited touch carried this campaign id.
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
     * The ISO 4217 code money is reported in. Amounts in another currency are converted at each day's exchange rate. Defaults to `USD`.
     *
     * @return string|null
     */
    public function getCurrency(): ?string
    {
        return $this->currency;
    }
    /**
     * The ISO 4217 code money is reported in. Amounts in another currency are converted at each day's exchange rate. Defaults to `USD`.
     *
     * @param string|null $currency
     *
     * @return self
     */
    public function setCurrency(?string $currency): self
    {
        $this->initialized['currency'] = true;
        $this->currency = $currency;
        return $this;
    }
    /**
     * The environment whose revenue counts: `production` (the default), `sandbox` or `test`. Visits come from production keys, or from test keys for `test`; signups count in every environment.
     *
     * @return string|null
     */
    public function getEnvironment(): ?string
    {
        return $this->environment;
    }
    /**
     * The environment whose revenue counts: `production` (the default), `sandbox` or `test`. Visits come from production keys, or from test keys for `test`; signups count in every environment.
     *
     * @param string|null $environment
     *
     * @return self
     */
    public function setEnvironment(?string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * The first acquisition day, `YYYY-MM-DD`, in the report time zone.
     *
     * @return string
     */
    public function getFrom(): string
    {
        return $this->from;
    }
    /**
     * The first acquisition day, `YYYY-MM-DD`, in the report time zone.
     *
     * @param string $from
     *
     * @return self
     */
    public function setFrom(string $from): self
    {
        $this->initialized['from'] = true;
        $this->from = $from;
        return $this;
    }
    /**
     * Whether every row also carries `days`, its outcomes per acquisition day.
     *
     * @return bool|null
     */
    public function getHasDailyRows(): ?bool
    {
        return $this->hasDailyRows;
    }
    /**
     * Whether every row also carries `days`, its outcomes per acquisition day.
     *
     * @param bool|null $hasDailyRows
     *
     * @return self
     */
    public function setHasDailyRows(?bool $hasDailyRows): self
    {
        $this->initialized['hasDailyRows'] = true;
        $this->hasDailyRows = $hasDailyRows;
        return $this;
    }
    /**
     * Whether every row also carries `signupSurfaces` and `paymentSurfaces`, its outcomes by signup and payment surface.
     *
     * @return bool|null
     */
    public function getHasSurfaceBreakdown(): ?bool
    {
        return $this->hasSurfaceBreakdown;
    }
    /**
     * Whether every row also carries `signupSurfaces` and `paymentSurfaces`, its outcomes by signup and payment surface.
     *
     * @param bool|null $hasSurfaceBreakdown
     *
     * @return self
     */
    public function setHasSurfaceBreakdown(?bool $hasSurfaceBreakdown): self
    {
        $this->initialized['hasSurfaceBreakdown'] = true;
        $this->hasSurfaceBreakdown = $hasSurfaceBreakdown;
        return $this;
    }
    /**
     * The conversion ad cost is measured against: `signup`, `trial` or `payer`. Omitted or null uses the project's setting.
     *
     * @return string|null
     */
    public function getKeyConversion(): ?string
    {
        return $this->keyConversion;
    }
    /**
     * The conversion ad cost is measured against: `signup`, `trial` or `payer`. Omitted or null uses the project's setting.
     *
     * @param string|null $keyConversion
     *
     * @return self
     */
    public function setKeyConversion(?string $keyConversion): self
    {
        $this->initialized['keyConversion'] = true;
        $this->keyConversion = $keyConversion;
        return $this;
    }
    /**
     * What rows group by: the credited touch's `network`, `campaign`, `adset` or `ad`, or `surface`, where people group by the surface they signed up on, or `cross_surface`.
     *
     * @return string
     */
    public function getLevel(): string
    {
        return $this->level;
    }
    /**
     * What rows group by: the credited touch's `network`, `campaign`, `adset` or `ad`, or `surface`, where people group by the surface they signed up on, or `cross_surface`.
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
     * Only people whose credited touch came from this ad network, such as `meta` or `google`. Compared in lowercase.
     *
     * @return string|null
     */
    public function getNetwork(): ?string
    {
        return $this->network;
    }
    /**
     * Only people whose credited touch came from this ad network, such as `meta` or `google`. Compared in lowercase.
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
     * Which revenue, signups and installs count: the first `days` after each person's acquisition, or everything up to the end of the `until` day. Defaults to everything up to now, so recent people have had less time to pay.
     *
     * @return mixed
     */
    public function getRevenueWindow()
    {
        return $this->revenueWindow;
    }
    /**
     * Which revenue, signups and installs count: the first `days` after each person's acquisition, or everything up to the end of the `until` day. Defaults to everything up to now, so recent people have had less time to pay.
     *
     * @param mixed $revenueWindow
     *
     * @return self
     */
    public function setRevenueWindow($revenueWindow): self
    {
        $this->initialized['revenueWindow'] = true;
        $this->revenueWindow = $revenueWindow;
        return $this;
    }
    /**
     * The IANA time zone that sets day boundaries, such as the ad account's. Offsets such as `+01:00` are rejected. Defaults to `UTC`.
     *
     * @return string|null
     */
    public function getTimezone(): ?string
    {
        return $this->timezone;
    }
    /**
     * The IANA time zone that sets day boundaries, such as the ad account's. Offsets such as `+01:00` are rejected. Defaults to `UTC`.
     *
     * @param string|null $timezone
     *
     * @return self
     */
    public function setTimezone(?string $timezone): self
    {
        $this->initialized['timezone'] = true;
        $this->timezone = $timezone;
        return $this;
    }
    /**
     * The last acquisition day, inclusive, `YYYY-MM-DD`. The range spans at most 366 days.
     *
     * @return string
     */
    public function getTo(): string
    {
        return $this->to;
    }
    /**
     * The last acquisition day, inclusive, `YYYY-MM-DD`. The range spans at most 366 days.
     *
     * @param string $to
     *
     * @return self
     */
    public function setTo(string $to): self
    {
        $this->initialized['to'] = true;
        $this->to = $to;
        return $this;
    }
}