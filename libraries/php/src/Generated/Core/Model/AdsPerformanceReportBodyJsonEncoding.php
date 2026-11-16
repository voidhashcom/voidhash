<?php

namespace Voidhash\Generated\Core\Model;

class AdsPerformanceReportBodyJsonEncoding
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
     * Only these campaigns, or the ad groups and ads under them, by the platform's ids. At most 100.
     *
     * @var list<string>|null
     */
    protected $campaignIds;
    /**
     * Only these ad groups, or the ads under them, by the platform's ids. At most 100.
     *
     * @var list<string>|null
     */
    protected $adGroupIds;
    /**
     * Only objects that are `active` (delivering or learning) or that `needs_attention` (learning limited, not delivering, rejected, or held by an account issue).
     *
     * @var string|null
     */
    protected $delivery;
    /**
     * Only objects whose ads send people to this destination.
     *
     * @var string|null
     */
    protected $destination;
    /**
     * Only those whose name contains this text, ignoring case, or whose id is exactly it. At most 200 characters.
     *
     * @var string|null
     */
    protected $search;
    /**
     * Extra numbers to read. `reach` reads reach and frequency from the platform for the page's rows, which makes the report slower.
     *
     * @var list<string>|null
     */
    protected $include;
    /**
     * How rows are ordered. Defaults to spend, highest first. Rates sort with null last.
     *
     * @var AdsPerformanceReportBodyJsonEncodingSort|null
     */
    protected $sort;
    /**
     * Rows per page, from 1 to 200; defaults to 50.
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
     * Only these campaigns, or the ad groups and ads under them, by the platform's ids. At most 100.
     *
     * @return list<string>|null
     */
    public function getCampaignIds(): ?array
    {
        return $this->campaignIds;
    }
    /**
     * Only these campaigns, or the ad groups and ads under them, by the platform's ids. At most 100.
     *
     * @param list<string>|null $campaignIds
     *
     * @return self
     */
    public function setCampaignIds(?array $campaignIds): self
    {
        $this->initialized['campaignIds'] = true;
        $this->campaignIds = $campaignIds;
        return $this;
    }
    /**
     * Only these ad groups, or the ads under them, by the platform's ids. At most 100.
     *
     * @return list<string>|null
     */
    public function getAdGroupIds(): ?array
    {
        return $this->adGroupIds;
    }
    /**
     * Only these ad groups, or the ads under them, by the platform's ids. At most 100.
     *
     * @param list<string>|null $adGroupIds
     *
     * @return self
     */
    public function setAdGroupIds(?array $adGroupIds): self
    {
        $this->initialized['adGroupIds'] = true;
        $this->adGroupIds = $adGroupIds;
        return $this;
    }
    /**
     * Only objects that are `active` (delivering or learning) or that `needs_attention` (learning limited, not delivering, rejected, or held by an account issue).
     *
     * @return string|null
     */
    public function getDelivery(): ?string
    {
        return $this->delivery;
    }
    /**
     * Only objects that are `active` (delivering or learning) or that `needs_attention` (learning limited, not delivering, rejected, or held by an account issue).
     *
     * @param string|null $delivery
     *
     * @return self
     */
    public function setDelivery(?string $delivery): self
    {
        $this->initialized['delivery'] = true;
        $this->delivery = $delivery;
        return $this;
    }
    /**
     * Only objects whose ads send people to this destination.
     *
     * @return string|null
     */
    public function getDestination(): ?string
    {
        return $this->destination;
    }
    /**
     * Only objects whose ads send people to this destination.
     *
     * @param string|null $destination
     *
     * @return self
     */
    public function setDestination(?string $destination): self
    {
        $this->initialized['destination'] = true;
        $this->destination = $destination;
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
     * Extra numbers to read. `reach` reads reach and frequency from the platform for the page's rows, which makes the report slower.
     *
     * @return list<string>|null
     */
    public function getInclude(): ?array
    {
        return $this->include;
    }
    /**
     * Extra numbers to read. `reach` reads reach and frequency from the platform for the page's rows, which makes the report slower.
     *
     * @param list<string>|null $include
     *
     * @return self
     */
    public function setInclude(?array $include): self
    {
        $this->initialized['include'] = true;
        $this->include = $include;
        return $this;
    }
    /**
     * How rows are ordered. Defaults to spend, highest first. Rates sort with null last.
     *
     * @return AdsPerformanceReportBodyJsonEncodingSort|null
     */
    public function getSort(): ?AdsPerformanceReportBodyJsonEncodingSort
    {
        return $this->sort;
    }
    /**
     * How rows are ordered. Defaults to spend, highest first. Rates sort with null last.
     *
     * @param AdsPerformanceReportBodyJsonEncodingSort|null $sort
     *
     * @return self
     */
    public function setSort(?AdsPerformanceReportBodyJsonEncodingSort $sort): self
    {
        $this->initialized['sort'] = true;
        $this->sort = $sort;
        return $this;
    }
    /**
     * Rows per page, from 1 to 200; defaults to 50.
     *
     * @return int|null
     */
    public function getLimit(): ?int
    {
        return $this->limit;
    }
    /**
     * Rows per page, from 1 to 200; defaults to 50.
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