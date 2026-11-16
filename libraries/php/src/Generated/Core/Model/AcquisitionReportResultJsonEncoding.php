<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionReportResultJsonEncoding
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
     * The project's id.
     *
     * @var string
     */
    protected $projectId;
    /**
     * What the rows group by.
     *
     * @var string
     */
    protected $level;
    /**
     * The network filter, lowercased; null without one.
     *
     * @var string|null
     */
    protected $network;
    /**
     * The campaign filter; null without one.
     *
     * @var string|null
     */
    protected $campaignId;
    /**
     * The ad set filter; null without one.
     *
     * @var string|null
     */
    protected $adsetId;
    /**
     * The ad filter; null without one.
     *
     * @var string|null
     */
    protected $adId;
    /**
     * The ISO 4217 code money is reported in, in integer minor units.
     *
     * @var string
     */
    protected $currency;
    /**
     * The IANA time zone that set day boundaries.
     *
     * @var string
     */
    protected $timezone;
    /**
     * The environment whose revenue counted: `production`, `sandbox` or `test`.
     *
     * @var string
     */
    protected $environment;
    /**
     * The key conversion counted in `keyConversions`: `signup`, `trial` or `payer`.
     *
     * @var string
     */
    protected $keyConversion;
    /**
     * The first acquisition day, `YYYY-MM-DD`.
     *
     * @var string
     */
    protected $from;
    /**
     * The last acquisition day, inclusive, `YYYY-MM-DD`.
     *
     * @var string
     */
    protected $to;
    /**
     * The start of `from` in the report time zone, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $start;
    /**
     * The start of the day after `to`, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $end;
    /**
     * Which revenue, signups and installs the report counted.
     *
     * @var mixed
     */
    protected $revenueWindow;
    /**
     * How many days before a signup a touch could be credited with it.
     *
     * @var int
     */
    protected $attributionWindowDays;
    /**
     * No revenue or signup after this instant counted: now, or the end of the revenue window if earlier. An ISO 8601 timestamp.
     *
     * @var string
     */
    protected $revenueEnd;
    /**
     * The people and visits touches in the range brought, highest net revenue first.
     *
     * @var list<AcquisitionGroup>
     */
    protected $groups;
    /**
     * People who signed up, first paid or started a trial in the range with no touch credited, on that day; null under a filter.
     *
     * @var AcquisitionReportResultJsonEncodingUnattributed|null
     */
    protected $unattributed;
    /**
     * Every group plus the unattributed people.
     *
     * @var AcquisitionReportResultJsonEncodingTotals
     */
    protected $totals;
    /**
     * The 20 most common answers the range's unattributed people gave to how they heard of the product, from the `$acquisition_source` person trait, most people first. An answer fewer than 2 people gave is left out, so one-off free text can't identify someone. Null under a filter and at `surface` level.
     *
     * @var list<AcquisitionReportResultJsonEncodingSelfReportedItem>|null
     */
    protected $selfReported;
    /**
     * Visits, measured app installs, signups, trials and payers of the people a touch acquired, each by its own surface. Signups and payers are always present; the other steps once the project has had them in the last 90 days.
     *
     * @var list<AcquisitionReportResultJsonEncodingFunnelItem>
     */
    protected $funnel;
    /**
     * Where the reported payers paid, and the most common cross-surface paths.
     *
     * @var AcquisitionReportResultJsonEncodingConvertedOn
     */
    protected $convertedOn;
    /**
     * The project's revenue between `start` and `revenueEnd`, and how much of it came from people whose signup was credited to a touch, at any time.
     *
     * @var AcquisitionReportResultJsonEncodingCoverage
     */
    protected $coverage;
    /**
     * The project's id.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project's id.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * What the rows group by.
     *
     * @return string
     */
    public function getLevel(): string
    {
        return $this->level;
    }
    /**
     * What the rows group by.
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
     * The network filter, lowercased; null without one.
     *
     * @return string|null
     */
    public function getNetwork(): ?string
    {
        return $this->network;
    }
    /**
     * The network filter, lowercased; null without one.
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
     * The campaign filter; null without one.
     *
     * @return string|null
     */
    public function getCampaignId(): ?string
    {
        return $this->campaignId;
    }
    /**
     * The campaign filter; null without one.
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
     * The ad set filter; null without one.
     *
     * @return string|null
     */
    public function getAdsetId(): ?string
    {
        return $this->adsetId;
    }
    /**
     * The ad set filter; null without one.
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
     * The ad filter; null without one.
     *
     * @return string|null
     */
    public function getAdId(): ?string
    {
        return $this->adId;
    }
    /**
     * The ad filter; null without one.
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
     * The ISO 4217 code money is reported in, in integer minor units.
     *
     * @return string
     */
    public function getCurrency(): string
    {
        return $this->currency;
    }
    /**
     * The ISO 4217 code money is reported in, in integer minor units.
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
     * The IANA time zone that set day boundaries.
     *
     * @return string
     */
    public function getTimezone(): string
    {
        return $this->timezone;
    }
    /**
     * The IANA time zone that set day boundaries.
     *
     * @param string $timezone
     *
     * @return self
     */
    public function setTimezone(string $timezone): self
    {
        $this->initialized['timezone'] = true;
        $this->timezone = $timezone;
        return $this;
    }
    /**
     * The environment whose revenue counted: `production`, `sandbox` or `test`.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The environment whose revenue counted: `production`, `sandbox` or `test`.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * The key conversion counted in `keyConversions`: `signup`, `trial` or `payer`.
     *
     * @return string
     */
    public function getKeyConversion(): string
    {
        return $this->keyConversion;
    }
    /**
     * The key conversion counted in `keyConversions`: `signup`, `trial` or `payer`.
     *
     * @param string $keyConversion
     *
     * @return self
     */
    public function setKeyConversion(string $keyConversion): self
    {
        $this->initialized['keyConversion'] = true;
        $this->keyConversion = $keyConversion;
        return $this;
    }
    /**
     * The first acquisition day, `YYYY-MM-DD`.
     *
     * @return string
     */
    public function getFrom(): string
    {
        return $this->from;
    }
    /**
     * The first acquisition day, `YYYY-MM-DD`.
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
    /**
     * The start of `from` in the report time zone, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStart(): string
    {
        return $this->start;
    }
    /**
     * The start of `from` in the report time zone, as an ISO 8601 timestamp.
     *
     * @param string $start
     *
     * @return self
     */
    public function setStart(string $start): self
    {
        $this->initialized['start'] = true;
        $this->start = $start;
        return $this;
    }
    /**
     * The start of the day after `to`, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getEnd(): string
    {
        return $this->end;
    }
    /**
     * The start of the day after `to`, as an ISO 8601 timestamp.
     *
     * @param string $end
     *
     * @return self
     */
    public function setEnd(string $end): self
    {
        $this->initialized['end'] = true;
        $this->end = $end;
        return $this;
    }
    /**
     * Which revenue, signups and installs the report counted.
     *
     * @return mixed
     */
    public function getRevenueWindow()
    {
        return $this->revenueWindow;
    }
    /**
     * Which revenue, signups and installs the report counted.
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
     * How many days before a signup a touch could be credited with it.
     *
     * @return int
     */
    public function getAttributionWindowDays(): int
    {
        return $this->attributionWindowDays;
    }
    /**
     * How many days before a signup a touch could be credited with it.
     *
     * @param int $attributionWindowDays
     *
     * @return self
     */
    public function setAttributionWindowDays(int $attributionWindowDays): self
    {
        $this->initialized['attributionWindowDays'] = true;
        $this->attributionWindowDays = $attributionWindowDays;
        return $this;
    }
    /**
     * No revenue or signup after this instant counted: now, or the end of the revenue window if earlier. An ISO 8601 timestamp.
     *
     * @return string
     */
    public function getRevenueEnd(): string
    {
        return $this->revenueEnd;
    }
    /**
     * No revenue or signup after this instant counted: now, or the end of the revenue window if earlier. An ISO 8601 timestamp.
     *
     * @param string $revenueEnd
     *
     * @return self
     */
    public function setRevenueEnd(string $revenueEnd): self
    {
        $this->initialized['revenueEnd'] = true;
        $this->revenueEnd = $revenueEnd;
        return $this;
    }
    /**
     * The people and visits touches in the range brought, highest net revenue first.
     *
     * @return list<AcquisitionGroup>
     */
    public function getGroups(): array
    {
        return $this->groups;
    }
    /**
     * The people and visits touches in the range brought, highest net revenue first.
     *
     * @param list<AcquisitionGroup> $groups
     *
     * @return self
     */
    public function setGroups(array $groups): self
    {
        $this->initialized['groups'] = true;
        $this->groups = $groups;
        return $this;
    }
    /**
     * People who signed up, first paid or started a trial in the range with no touch credited, on that day; null under a filter.
     *
     * @return AcquisitionReportResultJsonEncodingUnattributed|null
     */
    public function getUnattributed(): ?AcquisitionReportResultJsonEncodingUnattributed
    {
        return $this->unattributed;
    }
    /**
     * People who signed up, first paid or started a trial in the range with no touch credited, on that day; null under a filter.
     *
     * @param AcquisitionReportResultJsonEncodingUnattributed|null $unattributed
     *
     * @return self
     */
    public function setUnattributed(?AcquisitionReportResultJsonEncodingUnattributed $unattributed): self
    {
        $this->initialized['unattributed'] = true;
        $this->unattributed = $unattributed;
        return $this;
    }
    /**
     * Every group plus the unattributed people.
     *
     * @return AcquisitionReportResultJsonEncodingTotals
     */
    public function getTotals(): AcquisitionReportResultJsonEncodingTotals
    {
        return $this->totals;
    }
    /**
     * Every group plus the unattributed people.
     *
     * @param AcquisitionReportResultJsonEncodingTotals $totals
     *
     * @return self
     */
    public function setTotals(AcquisitionReportResultJsonEncodingTotals $totals): self
    {
        $this->initialized['totals'] = true;
        $this->totals = $totals;
        return $this;
    }
    /**
     * The 20 most common answers the range's unattributed people gave to how they heard of the product, from the `$acquisition_source` person trait, most people first. An answer fewer than 2 people gave is left out, so one-off free text can't identify someone. Null under a filter and at `surface` level.
     *
     * @return list<AcquisitionReportResultJsonEncodingSelfReportedItem>|null
     */
    public function getSelfReported(): ?array
    {
        return $this->selfReported;
    }
    /**
     * The 20 most common answers the range's unattributed people gave to how they heard of the product, from the `$acquisition_source` person trait, most people first. An answer fewer than 2 people gave is left out, so one-off free text can't identify someone. Null under a filter and at `surface` level.
     *
     * @param list<AcquisitionReportResultJsonEncodingSelfReportedItem>|null $selfReported
     *
     * @return self
     */
    public function setSelfReported(?array $selfReported): self
    {
        $this->initialized['selfReported'] = true;
        $this->selfReported = $selfReported;
        return $this;
    }
    /**
     * Visits, measured app installs, signups, trials and payers of the people a touch acquired, each by its own surface. Signups and payers are always present; the other steps once the project has had them in the last 90 days.
     *
     * @return list<AcquisitionReportResultJsonEncodingFunnelItem>
     */
    public function getFunnel(): array
    {
        return $this->funnel;
    }
    /**
     * Visits, measured app installs, signups, trials and payers of the people a touch acquired, each by its own surface. Signups and payers are always present; the other steps once the project has had them in the last 90 days.
     *
     * @param list<AcquisitionReportResultJsonEncodingFunnelItem> $funnel
     *
     * @return self
     */
    public function setFunnel(array $funnel): self
    {
        $this->initialized['funnel'] = true;
        $this->funnel = $funnel;
        return $this;
    }
    /**
     * Where the reported payers paid, and the most common cross-surface paths.
     *
     * @return AcquisitionReportResultJsonEncodingConvertedOn
     */
    public function getConvertedOn(): AcquisitionReportResultJsonEncodingConvertedOn
    {
        return $this->convertedOn;
    }
    /**
     * Where the reported payers paid, and the most common cross-surface paths.
     *
     * @param AcquisitionReportResultJsonEncodingConvertedOn $convertedOn
     *
     * @return self
     */
    public function setConvertedOn(AcquisitionReportResultJsonEncodingConvertedOn $convertedOn): self
    {
        $this->initialized['convertedOn'] = true;
        $this->convertedOn = $convertedOn;
        return $this;
    }
    /**
     * The project's revenue between `start` and `revenueEnd`, and how much of it came from people whose signup was credited to a touch, at any time.
     *
     * @return AcquisitionReportResultJsonEncodingCoverage
     */
    public function getCoverage(): AcquisitionReportResultJsonEncodingCoverage
    {
        return $this->coverage;
    }
    /**
     * The project's revenue between `start` and `revenueEnd`, and how much of it came from people whose signup was credited to a touch, at any time.
     *
     * @param AcquisitionReportResultJsonEncodingCoverage $coverage
     *
     * @return self
     */
    public function setCoverage(AcquisitionReportResultJsonEncodingCoverage $coverage): self
    {
        $this->initialized['coverage'] = true;
        $this->coverage = $coverage;
        return $this;
    }
}