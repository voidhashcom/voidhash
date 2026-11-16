<?php

namespace Voidhash\Generated\Core\Model;

class AdsCreativesReportJsonEncoding
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
     * @var list<AdsCreativeRow>
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
     * The items on this page, in list order.
     *
     * @return list<AdsCreativeRow>
     */
    public function getData(): array
    {
        return $this->data;
    }
    /**
     * The items on this page, in list order.
     *
     * @param list<AdsCreativeRow> $data
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
}