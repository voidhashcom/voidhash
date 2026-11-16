<?php

namespace Voidhash\Generated\Core\Model;

class AdsCreativesReportBodyJsonEncoding
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
     * Only creatives of these formats: `image`, `video` or `carousel`.
     *
     * @var list<string>|null
     */
    protected $formats;
    /**
     * Only those whose name contains this text, ignoring case, or whose id is exactly it. At most 200 characters.
     *
     * @var string|null
     */
    protected $search;
    /**
     * Creatives per page, from 1 to 100; defaults to 50.
     *
     * @var int|null
     */
    protected $limit;
    /**
     * Where to resume: the `pageInfo.endCursor` of the previous page.
     *
     * @var string|null
     */
    protected $cursor;
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
     * Only creatives of these formats: `image`, `video` or `carousel`.
     *
     * @return list<string>|null
     */
    public function getFormats(): ?array
    {
        return $this->formats;
    }
    /**
     * Only creatives of these formats: `image`, `video` or `carousel`.
     *
     * @param list<string>|null $formats
     *
     * @return self
     */
    public function setFormats(?array $formats): self
    {
        $this->initialized['formats'] = true;
        $this->formats = $formats;
        return $this;
    }
    /**
     * Only those whose name contains this text, ignoring case, or whose id is exactly it. At most 200 characters.
     *
     * @return string|null
     */
    public function getSearch(): ?string
    {
        return $this->search;
    }
    /**
     * Only those whose name contains this text, ignoring case, or whose id is exactly it. At most 200 characters.
     *
     * @param string|null $search
     *
     * @return self
     */
    public function setSearch(?string $search): self
    {
        $this->initialized['search'] = true;
        $this->search = $search;
        return $this;
    }
    /**
     * Creatives per page, from 1 to 100; defaults to 50.
     *
     * @return int|null
     */
    public function getLimit(): ?int
    {
        return $this->limit;
    }
    /**
     * Creatives per page, from 1 to 100; defaults to 50.
     *
     * @param int|null $limit
     *
     * @return self
     */
    public function setLimit(?int $limit): self
    {
        $this->initialized['limit'] = true;
        $this->limit = $limit;
        return $this;
    }
    /**
     * Where to resume: the `pageInfo.endCursor` of the previous page.
     *
     * @return string|null
     */
    public function getCursor(): ?string
    {
        return $this->cursor;
    }
    /**
     * Where to resume: the `pageInfo.endCursor` of the previous page.
     *
     * @param string|null $cursor
     *
     * @return self
     */
    public function setCursor(?string $cursor): self
    {
        $this->initialized['cursor'] = true;
        $this->cursor = $cursor;
        return $this;
    }
}