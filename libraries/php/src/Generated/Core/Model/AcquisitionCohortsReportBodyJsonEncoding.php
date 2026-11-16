<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionCohortsReportBodyJsonEncoding
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
     * What cohorts group by: the surface people signed up on (`surface`), or the credited touch's `network`, `campaign` or `adset`.
     *
     * @var string
     */
    protected $groupBy;
    /**
     * Only people whose credited touch came from this ad network, such as `meta`. Compared in lowercase.
     *
     * @var string|null
     */
    protected $network;
    /**
     * The IANA time zone that sets day boundaries, such as the ad account's. Offsets such as `+01:00` are rejected. Defaults to `UTC`.
     *
     * @var string|null
     */
    protected $timezone;
    /**
     * The last acquisition day, inclusive, `YYYY-MM-DD`.
     *
     * @var string
     */
    protected $to;
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
     * What cohorts group by: the surface people signed up on (`surface`), or the credited touch's `network`, `campaign` or `adset`.
     *
     * @return string
     */
    public function getGroupBy(): string
    {
        return $this->groupBy;
    }
    /**
     * What cohorts group by: the surface people signed up on (`surface`), or the credited touch's `network`, `campaign` or `adset`.
     *
     * @param string $groupBy
     *
     * @return self
     */
    public function setGroupBy(string $groupBy): self
    {
        $this->initialized['groupBy'] = true;
        $this->groupBy = $groupBy;
        return $this;
    }
    /**
     * Only people whose credited touch came from this ad network, such as `meta`. Compared in lowercase.
     *
     * @return string|null
     */
    public function getNetwork(): ?string
    {
        return $this->network;
    }
    /**
     * Only people whose credited touch came from this ad network, such as `meta`. Compared in lowercase.
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
     * The last acquisition day, inclusive, `YYYY-MM-DD`.
     *
     * @return string
     */
    public function getTo(): string
    {
        return $this->to;
    }
    /**
     * The last acquisition day, inclusive, `YYYY-MM-DD`.
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