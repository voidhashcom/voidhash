<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartResponseItem
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
     * The `key` of the query this answers.
     *
     * @var string
     */
    protected $key;
    /**
     * A chart of the catalog, such as `mrr_trend` or `paywall_funnel`.
     *
     * @var string
     */
    protected $chartId;
    /**
     * The range the chart covers, with presets resolved.
     *
     * @var AnalyticsChartResponseItemResolvedTimeRange
     */
    protected $resolvedTimeRange;
    /**
     * The ISO 4217 code the result's money is in, as integer minor units; null when it has none.
     *
     * @var string|null
     */
    protected $currency;
    /**
     * The chart's result; `shape` says which kind it is.
     *
     * @var AnalyticsChartSeriesResult|AnalyticsChartTableResult|AnalyticsChartFunnelResult|AnalyticsChartCohortsResult|AnalyticsChartCurvesResult|AnalyticsChartHistogramResult|AnalyticsChartHeatmapResult|AnalyticsChartFlowResult|AnalyticsChartStatsResult|AnalyticsChartPointsResult|AnalyticsChartMarkersResult|AnalyticsChartOptionsResult
     */
    protected $result;
    /**
     * The `key` of the query this answers.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The `key` of the query this answers.
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
     * The range the chart covers, with presets resolved.
     *
     * @return AnalyticsChartResponseItemResolvedTimeRange
     */
    public function getResolvedTimeRange(): AnalyticsChartResponseItemResolvedTimeRange
    {
        return $this->resolvedTimeRange;
    }
    /**
     * The range the chart covers, with presets resolved.
     *
     * @param AnalyticsChartResponseItemResolvedTimeRange $resolvedTimeRange
     *
     * @return self
     */
    public function setResolvedTimeRange(AnalyticsChartResponseItemResolvedTimeRange $resolvedTimeRange): self
    {
        $this->initialized['resolvedTimeRange'] = true;
        $this->resolvedTimeRange = $resolvedTimeRange;
        return $this;
    }
    /**
     * The ISO 4217 code the result's money is in, as integer minor units; null when it has none.
     *
     * @return string|null
     */
    public function getCurrency(): ?string
    {
        return $this->currency;
    }
    /**
     * The ISO 4217 code the result's money is in, as integer minor units; null when it has none.
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
     * The chart's result; `shape` says which kind it is.
     *
     * @return AnalyticsChartSeriesResult|AnalyticsChartTableResult|AnalyticsChartFunnelResult|AnalyticsChartCohortsResult|AnalyticsChartCurvesResult|AnalyticsChartHistogramResult|AnalyticsChartHeatmapResult|AnalyticsChartFlowResult|AnalyticsChartStatsResult|AnalyticsChartPointsResult|AnalyticsChartMarkersResult|AnalyticsChartOptionsResult
     */
    public function getResult()
    {
        return $this->result;
    }
    /**
     * The chart's result; `shape` says which kind it is.
     *
     * @param AnalyticsChartSeriesResult|AnalyticsChartTableResult|AnalyticsChartFunnelResult|AnalyticsChartCohortsResult|AnalyticsChartCurvesResult|AnalyticsChartHistogramResult|AnalyticsChartHeatmapResult|AnalyticsChartFlowResult|AnalyticsChartStatsResult|AnalyticsChartPointsResult|AnalyticsChartMarkersResult|AnalyticsChartOptionsResult $result
     *
     * @return self
     */
    public function setResult($result): self
    {
        $this->initialized['result'] = true;
        $this->result = $result;
        return $this;
    }
}