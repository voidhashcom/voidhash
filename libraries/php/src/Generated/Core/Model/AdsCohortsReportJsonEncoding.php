<?php

namespace Voidhash\Generated\Core\Model;

class AdsCohortsReportJsonEncoding
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
     * The first day of the range, `YYYY-MM-DD`.
     *
     * @var string
     */
    protected $from;
    /**
     * The last day of the range, inclusive, `YYYY-MM-DD`.
     *
     * @var string
     */
    protected $to;
    /**
     * ISO 4217 code of every amount.
     *
     * @var string
     */
    protected $currency;
    /**
     * IANA time zone the days are cut in.
     *
     * @var string
     */
    protected $timezone;
    /**
     * Environment measured purchases were read from: `production`, `sandbox` (store sandboxes such as TestFlight) or `test` (simulated purchases).
     *
     * @var string
     */
    protected $environment;
    /**
     * Whether the credential may read measured numbers (`project:analytics:read`); without it every `measured` and `modeled` is null.
     *
     * @var bool
     */
    protected $hasMeasuredAccess;
    /**
     * The first day whose numbers are still provisional: the platform still attributes conversions to it, and people acquired since can still convert. Null when all are final.
     *
     * @var string|null
     */
    protected $provisionalFrom;
    /**
     * Caveats about how complete or comparable the numbers are; empty when there are none.
     *
     * @var list<AdsReportWarningCurrencyConverted>|list<AdsReportWarningNoExchangeRate>|list<AdsReportWarningTimezoneDiffers>|list<AdsReportWarningSyncPending>|list<AdsReportWarningSyncStopped>|list<AdsReportWarningSyncFailed>|list<AdsReportWarningRangeIncludesToday>|list<AdsReportWarningBreakdownsNotKept>|list<AdsReportWarningReachLimited>|list<AdsReportWarningReachUnavailable>|list<AdsReportWarningTooManyObjects>
     */
    protected $warnings;
    /**
     * What each curve in `groups` is for: a `surface` (web, iOS, Android), an ad `platform`, a `campaign` or an `ad_group`.
     *
     * @var string
     */
    protected $groupBy;
    /**
     * Whether cohorts are of a `week` or a `month` of acquisition.
     *
     * @var string
     */
    protected $unit;
    /**
     * `roas`: cumulative net revenue per the cohort's spend, a decimal. `revenue_per_payer`: cumulative net revenue per payer, in minor units. `payers`: cumulative payers.
     *
     * @var string
     */
    protected $metric;
    /**
     * One row per week or month of acquisition, across every group.
     *
     * @var list<AdsCohortsReportJsonEncodingCohortsItem>
     */
    protected $cohorts;
    /**
     * The spend-weighted average of the cohorts old enough for each day.
     *
     * @var AdsCohortsReportJsonEncodingAverage
     */
    protected $average;
    /**
     * One cumulative curve per group, over all its cohorts.
     *
     * @var list<AdsCohortsReportJsonEncodingGroupsItem>
     */
    protected $groups;
    /**
     * The first day of the range, `YYYY-MM-DD`.
     *
     * @return string
     */
    public function getFrom(): string
    {
        return $this->from;
    }
    /**
     * The first day of the range, `YYYY-MM-DD`.
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
     * The last day of the range, inclusive, `YYYY-MM-DD`.
     *
     * @return string
     */
    public function getTo(): string
    {
        return $this->to;
    }
    /**
     * The last day of the range, inclusive, `YYYY-MM-DD`.
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
     * ISO 4217 code of every amount.
     *
     * @return string
     */
    public function getCurrency(): string
    {
        return $this->currency;
    }
    /**
     * ISO 4217 code of every amount.
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
     * IANA time zone the days are cut in.
     *
     * @return string
     */
    public function getTimezone(): string
    {
        return $this->timezone;
    }
    /**
     * IANA time zone the days are cut in.
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
     * Environment measured purchases were read from: `production`, `sandbox` (store sandboxes such as TestFlight) or `test` (simulated purchases).
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * Environment measured purchases were read from: `production`, `sandbox` (store sandboxes such as TestFlight) or `test` (simulated purchases).
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
     * Whether the credential may read measured numbers (`project:analytics:read`); without it every `measured` and `modeled` is null.
     *
     * @return bool
     */
    public function getHasMeasuredAccess(): bool
    {
        return $this->hasMeasuredAccess;
    }
    /**
     * Whether the credential may read measured numbers (`project:analytics:read`); without it every `measured` and `modeled` is null.
     *
     * @param bool $hasMeasuredAccess
     *
     * @return self
     */
    public function setHasMeasuredAccess(bool $hasMeasuredAccess): self
    {
        $this->initialized['hasMeasuredAccess'] = true;
        $this->hasMeasuredAccess = $hasMeasuredAccess;
        return $this;
    }
    /**
     * The first day whose numbers are still provisional: the platform still attributes conversions to it, and people acquired since can still convert. Null when all are final.
     *
     * @return string|null
     */
    public function getProvisionalFrom(): ?string
    {
        return $this->provisionalFrom;
    }
    /**
     * The first day whose numbers are still provisional: the platform still attributes conversions to it, and people acquired since can still convert. Null when all are final.
     *
     * @param string|null $provisionalFrom
     *
     * @return self
     */
    public function setProvisionalFrom(?string $provisionalFrom): self
    {
        $this->initialized['provisionalFrom'] = true;
        $this->provisionalFrom = $provisionalFrom;
        return $this;
    }
    /**
     * Caveats about how complete or comparable the numbers are; empty when there are none.
     *
     * @return list<AdsReportWarningCurrencyConverted>|list<AdsReportWarningNoExchangeRate>|list<AdsReportWarningTimezoneDiffers>|list<AdsReportWarningSyncPending>|list<AdsReportWarningSyncStopped>|list<AdsReportWarningSyncFailed>|list<AdsReportWarningRangeIncludesToday>|list<AdsReportWarningBreakdownsNotKept>|list<AdsReportWarningReachLimited>|list<AdsReportWarningReachUnavailable>|list<AdsReportWarningTooManyObjects>
     */
    public function getWarnings(): array
    {
        return $this->warnings;
    }
    /**
     * Caveats about how complete or comparable the numbers are; empty when there are none.
     *
     * @param list<AdsReportWarningCurrencyConverted>|list<AdsReportWarningNoExchangeRate>|list<AdsReportWarningTimezoneDiffers>|list<AdsReportWarningSyncPending>|list<AdsReportWarningSyncStopped>|list<AdsReportWarningSyncFailed>|list<AdsReportWarningRangeIncludesToday>|list<AdsReportWarningBreakdownsNotKept>|list<AdsReportWarningReachLimited>|list<AdsReportWarningReachUnavailable>|list<AdsReportWarningTooManyObjects> $warnings
     *
     * @return self
     */
    public function setWarnings(array $warnings): self
    {
        $this->initialized['warnings'] = true;
        $this->warnings = $warnings;
        return $this;
    }
    /**
     * What each curve in `groups` is for: a `surface` (web, iOS, Android), an ad `platform`, a `campaign` or an `ad_group`.
     *
     * @return string
     */
    public function getGroupBy(): string
    {
        return $this->groupBy;
    }
    /**
     * What each curve in `groups` is for: a `surface` (web, iOS, Android), an ad `platform`, a `campaign` or an `ad_group`.
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
     * Whether cohorts are of a `week` or a `month` of acquisition.
     *
     * @return string
     */
    public function getUnit(): string
    {
        return $this->unit;
    }
    /**
     * Whether cohorts are of a `week` or a `month` of acquisition.
     *
     * @param string $unit
     *
     * @return self
     */
    public function setUnit(string $unit): self
    {
        $this->initialized['unit'] = true;
        $this->unit = $unit;
        return $this;
    }
    /**
     * `roas`: cumulative net revenue per the cohort's spend, a decimal. `revenue_per_payer`: cumulative net revenue per payer, in minor units. `payers`: cumulative payers.
     *
     * @return string
     */
    public function getMetric(): string
    {
        return $this->metric;
    }
    /**
     * `roas`: cumulative net revenue per the cohort's spend, a decimal. `revenue_per_payer`: cumulative net revenue per payer, in minor units. `payers`: cumulative payers.
     *
     * @param string $metric
     *
     * @return self
     */
    public function setMetric(string $metric): self
    {
        $this->initialized['metric'] = true;
        $this->metric = $metric;
        return $this;
    }
    /**
     * One row per week or month of acquisition, across every group.
     *
     * @return list<AdsCohortsReportJsonEncodingCohortsItem>
     */
    public function getCohorts(): array
    {
        return $this->cohorts;
    }
    /**
     * One row per week or month of acquisition, across every group.
     *
     * @param list<AdsCohortsReportJsonEncodingCohortsItem> $cohorts
     *
     * @return self
     */
    public function setCohorts(array $cohorts): self
    {
        $this->initialized['cohorts'] = true;
        $this->cohorts = $cohorts;
        return $this;
    }
    /**
     * The spend-weighted average of the cohorts old enough for each day.
     *
     * @return AdsCohortsReportJsonEncodingAverage
     */
    public function getAverage(): AdsCohortsReportJsonEncodingAverage
    {
        return $this->average;
    }
    /**
     * The spend-weighted average of the cohorts old enough for each day.
     *
     * @param AdsCohortsReportJsonEncodingAverage $average
     *
     * @return self
     */
    public function setAverage(AdsCohortsReportJsonEncodingAverage $average): self
    {
        $this->initialized['average'] = true;
        $this->average = $average;
        return $this;
    }
    /**
     * One cumulative curve per group, over all its cohorts.
     *
     * @return list<AdsCohortsReportJsonEncodingGroupsItem>
     */
    public function getGroups(): array
    {
        return $this->groups;
    }
    /**
     * One cumulative curve per group, over all its cohorts.
     *
     * @param list<AdsCohortsReportJsonEncodingGroupsItem> $groups
     *
     * @return self
     */
    public function setGroups(array $groups): self
    {
        $this->initialized['groups'] = true;
        $this->groups = $groups;
        return $this;
    }
}