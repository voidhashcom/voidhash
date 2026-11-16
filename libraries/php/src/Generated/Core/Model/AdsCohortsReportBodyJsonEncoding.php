<?php

namespace Voidhash\Generated\Core\Model;

class AdsCohortsReportBodyJsonEncoding
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
     * The first day of the range, `YYYY-MM-DD` in `timezone`.
     *
     * @var string
     */
    protected $from;
    /**
     * The last day of the range, inclusive, `YYYY-MM-DD` in `timezone`. A report spans at most 366 days.
     *
     * @var string
     */
    protected $to;
    /**
     * ISO 4217 code to report money in. Defaults to the project's reporting currency, else the connected accounts' when they share one, else USD.
     *
     * @var string|null
     */
    protected $currency;
    /**
     * IANA time zone the days are cut in, such as `Europe/Prague`. Defaults to the connected accounts' when they share one, else UTC.
     *
     * @var string|null
     */
    protected $timezone;
    /**
     * Environment measured purchases are read from: `production`, `sandbox` (store sandboxes such as TestFlight) or `test` (simulated purchases). Defaults to `production`.
     *
     * @var string|null
     */
    protected $environment;
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
     * The first day of the range, `YYYY-MM-DD` in `timezone`.
     *
     * @return string
     */
    public function getFrom(): string
    {
        return $this->from;
    }
    /**
     * The first day of the range, `YYYY-MM-DD` in `timezone`.
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
     * The last day of the range, inclusive, `YYYY-MM-DD` in `timezone`. A report spans at most 366 days.
     *
     * @return string
     */
    public function getTo(): string
    {
        return $this->to;
    }
    /**
     * The last day of the range, inclusive, `YYYY-MM-DD` in `timezone`. A report spans at most 366 days.
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
     * ISO 4217 code to report money in. Defaults to the project's reporting currency, else the connected accounts' when they share one, else USD.
     *
     * @return string|null
     */
    public function getCurrency(): ?string
    {
        return $this->currency;
    }
    /**
     * ISO 4217 code to report money in. Defaults to the project's reporting currency, else the connected accounts' when they share one, else USD.
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
     * IANA time zone the days are cut in, such as `Europe/Prague`. Defaults to the connected accounts' when they share one, else UTC.
     *
     * @return string|null
     */
    public function getTimezone(): ?string
    {
        return $this->timezone;
    }
    /**
     * IANA time zone the days are cut in, such as `Europe/Prague`. Defaults to the connected accounts' when they share one, else UTC.
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
     * Environment measured purchases are read from: `production`, `sandbox` (store sandboxes such as TestFlight) or `test` (simulated purchases). Defaults to `production`.
     *
     * @return string|null
     */
    public function getEnvironment(): ?string
    {
        return $this->environment;
    }
    /**
     * Environment measured purchases are read from: `production`, `sandbox` (store sandboxes such as TestFlight) or `test` (simulated purchases). Defaults to `production`.
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
}