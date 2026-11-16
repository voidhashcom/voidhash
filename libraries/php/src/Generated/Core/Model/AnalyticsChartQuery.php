<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartQuery
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
     * A chart of the catalog, such as `mrr_trend` or `paywall_funnel`.
     *
     * @var string
     */
    protected $chartId;
    /**
     * A name you choose for the query, returned on its result.
     *
     * @var string
     */
    protected $key;
    /**
     * The time range a query covers: a named window ending now, or an explicit `start` and `end`. Each result echoes the absolute range it resolved to.
     *
     * @var AnalyticsPresetTimeRange|AnalyticsCustomTimeRange
     */
    protected $timeRange;
    /**
     * The width of each point of a series chart: `hour`, `day`, `week` or `month`. Defaults to `day`.
     *
     * @var string|null
     */
    protected $granularity;
    /**
     * The IANA time zone that sets day, week and month boundaries and the start of the calendar presets, such as `Europe/Prague`. Defaults to `UTC`.
     *
     * @var string|null
     */
    protected $timezone;
    /**
     * Whether to also return the period of the same length just before the range, for series and stats charts. Defaults to false.
     *
     * @var bool|null
     */
    protected $hasComparison;
    /**
     * What to narrow the chart by, each a list of up to 100 values. A chart ignores the filters its catalog entry does not list; the `filter_options` chart returns the values each filter takes.
     *
     * @var AnalyticsChartFilters
     */
    protected $filters;
    /**
     * Choices a chart reads, each named in its catalog entry; the others are ignored.
     *
     * @var AnalyticsChartOptions
     */
    protected $options;
    /**
     * A chart of the catalog, such as `mrr_trend` or `paywall_funnel`.
     *
     * @return string
     */
    public function getChartId(): string
    {
        return $this->chartId;
    }
    /**
     * A chart of the catalog, such as `mrr_trend` or `paywall_funnel`.
     *
     * @param string $chartId
     *
     * @return self
     */
    public function setChartId(string $chartId): self
    {
        $this->initialized['chartId'] = true;
        $this->chartId = $chartId;
        return $this;
    }
    /**
     * A name you choose for the query, returned on its result.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * A name you choose for the query, returned on its result.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * The time range a query covers: a named window ending now, or an explicit `start` and `end`. Each result echoes the absolute range it resolved to.
     *
     * @return AnalyticsPresetTimeRange|AnalyticsCustomTimeRange
     */
    public function getTimeRange()
    {
        return $this->timeRange;
    }
    /**
     * The time range a query covers: a named window ending now, or an explicit `start` and `end`. Each result echoes the absolute range it resolved to.
     *
     * @param AnalyticsPresetTimeRange|AnalyticsCustomTimeRange $timeRange
     *
     * @return self
     */
    public function setTimeRange($timeRange): self
    {
        $this->initialized['timeRange'] = true;
        $this->timeRange = $timeRange;
        return $this;
    }
    /**
     * The width of each point of a series chart: `hour`, `day`, `week` or `month`. Defaults to `day`.
     *
     * @return string|null
     */
    public function getGranularity(): ?string
    {
        return $this->granularity;
    }
    /**
     * The width of each point of a series chart: `hour`, `day`, `week` or `month`. Defaults to `day`.
     *
     * @param string|null $granularity
     *
     * @return self
     */
    public function setGranularity(?string $granularity): self
    {
        $this->initialized['granularity'] = true;
        $this->granularity = $granularity;
        return $this;
    }
    /**
     * The IANA time zone that sets day, week and month boundaries and the start of the calendar presets, such as `Europe/Prague`. Defaults to `UTC`.
     *
     * @return string|null
     */
    public function getTimezone(): ?string
    {
        return $this->timezone;
    }
    /**
     * The IANA time zone that sets day, week and month boundaries and the start of the calendar presets, such as `Europe/Prague`. Defaults to `UTC`.
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
     * Whether to also return the period of the same length just before the range, for series and stats charts. Defaults to false.
     *
     * @return bool|null
     */
    public function getHasComparison(): ?bool
    {
        return $this->hasComparison;
    }
    /**
     * Whether to also return the period of the same length just before the range, for series and stats charts. Defaults to false.
     *
     * @param bool|null $hasComparison
     *
     * @return self
     */
    public function setHasComparison(?bool $hasComparison): self
    {
        $this->initialized['hasComparison'] = true;
        $this->hasComparison = $hasComparison;
        return $this;
    }
    /**
     * What to narrow the chart by, each a list of up to 100 values. A chart ignores the filters its catalog entry does not list; the `filter_options` chart returns the values each filter takes.
     *
     * @return AnalyticsChartFilters
     */
    public function getFilters(): AnalyticsChartFilters
    {
        return $this->filters;
    }
    /**
     * What to narrow the chart by, each a list of up to 100 values. A chart ignores the filters its catalog entry does not list; the `filter_options` chart returns the values each filter takes.
     *
     * @param AnalyticsChartFilters $filters
     *
     * @return self
     */
    public function setFilters(AnalyticsChartFilters $filters): self
    {
        $this->initialized['filters'] = true;
        $this->filters = $filters;
        return $this;
    }
    /**
     * Choices a chart reads, each named in its catalog entry; the others are ignored.
     *
     * @return AnalyticsChartOptions
     */
    public function getOptions(): AnalyticsChartOptions
    {
        return $this->options;
    }
    /**
     * Choices a chart reads, each named in its catalog entry; the others are ignored.
     *
     * @param AnalyticsChartOptions $options
     *
     * @return self
     */
    public function setOptions(AnalyticsChartOptions $options): self
    {
        $this->initialized['options'] = true;
        $this->options = $options;
        return $this;
    }
}