<?php

namespace Voidhash\Generated\Core\Model;

class AdsPerformanceReportJsonEncoding
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
     * The items on this page, in list order.
     *
     * @var list<AdsPerformanceRow>
     */
    protected $data;
    /**
     * Where this page ends.
     *
     * @var PageInfo
     */
    protected $pageInfo;
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
     * The level of the ad hierarchy: `campaign`, `ad_group` (Meta: ad set) or `ad`.
     *
     * @var string
     */
    protected $level;
    /**
     * A dimension rows are sliced by. `surface` (`web`, `ios`, `android`) slices measured numbers; the others slice the platform's: `country` (`CZ`), `age` (`25-34`), `gender`, `device`, and `placement` (`instagram|story`).
     *
     * @var string
     */
    protected $breakdown;
    /**
     * The step the project judges its ads by, which `keyConversions` counts: `signup`, `trial` or `payer` (the default), set in the project's settings.
     *
     * @var string
     */
    protected $keyConversion;
    /**
     * Every matching row together, not only this page.
     *
     * @var AdsPerformanceReportJsonEncodingTotals
     */
    protected $totals;
    /**
     * Account delivery no ad accounts for, such as spend on deleted ads; the totals plus this are the accounts' whole delivery. Null when filters narrow the rows, or when more objects match than a report covers (the `too_many_objects` warning).
     *
     * @var AdsPerformanceReportJsonEncodingUnallocated|null
     */
    protected $unallocated;
    /**
     * The items on this page, in list order.
     *
     * @return list<AdsPerformanceRow>
     */
    public function getData(): array
    {
        return $this->data;
    }
    /**
     * The items on this page, in list order.
     *
     * @param list<AdsPerformanceRow> $data
     *
     * @return self
     */
    public function setData(array $data): self
    {
        $this->initialized['data'] = true;
        $this->data = $data;
        return $this;
    }
    /**
     * Where this page ends.
     *
     * @return PageInfo
     */
    public function getPageInfo(): PageInfo
    {
        return $this->pageInfo;
    }
    /**
     * Where this page ends.
     *
     * @param PageInfo $pageInfo
     *
     * @return self
     */
    public function setPageInfo(PageInfo $pageInfo): self
    {
        $this->initialized['pageInfo'] = true;
        $this->pageInfo = $pageInfo;
        return $this;
    }
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
     * A dimension rows are sliced by. `surface` (`web`, `ios`, `android`) slices measured numbers; the others slice the platform's: `country` (`CZ`), `age` (`25-34`), `gender`, `device`, and `placement` (`instagram|story`).
     *
     * @return string
     */
    public function getBreakdown(): string
    {
        return $this->breakdown;
    }
    /**
     * A dimension rows are sliced by. `surface` (`web`, `ios`, `android`) slices measured numbers; the others slice the platform's: `country` (`CZ`), `age` (`25-34`), `gender`, `device`, and `placement` (`instagram|story`).
     *
     * @param string $breakdown
     *
     * @return self
     */
    public function setBreakdown(string $breakdown): self
    {
        $this->initialized['breakdown'] = true;
        $this->breakdown = $breakdown;
        return $this;
    }
    /**
     * The step the project judges its ads by, which `keyConversions` counts: `signup`, `trial` or `payer` (the default), set in the project's settings.
     *
     * @return string
     */
    public function getKeyConversion(): string
    {
        return $this->keyConversion;
    }
    /**
     * The step the project judges its ads by, which `keyConversions` counts: `signup`, `trial` or `payer` (the default), set in the project's settings.
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
     * Every matching row together, not only this page.
     *
     * @return AdsPerformanceReportJsonEncodingTotals
     */
    public function getTotals(): AdsPerformanceReportJsonEncodingTotals
    {
        return $this->totals;
    }
    /**
     * Every matching row together, not only this page.
     *
     * @param AdsPerformanceReportJsonEncodingTotals $totals
     *
     * @return self
     */
    public function setTotals(AdsPerformanceReportJsonEncodingTotals $totals): self
    {
        $this->initialized['totals'] = true;
        $this->totals = $totals;
        return $this;
    }
    /**
     * Account delivery no ad accounts for, such as spend on deleted ads; the totals plus this are the accounts' whole delivery. Null when filters narrow the rows, or when more objects match than a report covers (the `too_many_objects` warning).
     *
     * @return AdsPerformanceReportJsonEncodingUnallocated|null
     */
    public function getUnallocated(): ?AdsPerformanceReportJsonEncodingUnallocated
    {
        return $this->unallocated;
    }
    /**
     * Account delivery no ad accounts for, such as spend on deleted ads; the totals plus this are the accounts' whole delivery. Null when filters narrow the rows, or when more objects match than a report covers (the `too_many_objects` warning).
     *
     * @param AdsPerformanceReportJsonEncodingUnallocated|null $unallocated
     *
     * @return self
     */
    public function setUnallocated(?AdsPerformanceReportJsonEncodingUnallocated $unallocated): self
    {
        $this->initialized['unallocated'] = true;
        $this->unallocated = $unallocated;
        return $this;
    }
}