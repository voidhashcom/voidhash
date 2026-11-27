<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsMetricQuery
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
     * A name you choose for the query, returned on its result.
     *
     * @var string
     */
    protected $key;
    /**
     * What to measure: MRR and its movements, revenue, refunds, subscriptions and trials, paying customers, or one of the project's own events; `kind` says which.
     *
     * @var AnalyticsMrrMetric|AnalyticsRevenueMetric|AnalyticsNewMrrMetric|AnalyticsExpansionMrrMetric|AnalyticsReactivationMrrMetric|AnalyticsContractionMrrMetric|AnalyticsChurnedMrrMetric|AnalyticsNetNewMrrMetric|AnalyticsRefundsMetric|AnalyticsActiveSubscriptionsMetric|AnalyticsActiveTrialsMetric|AnalyticsNewSubscriptionsMetric|AnalyticsChurnedSubscriptionsMetric|AnalyticsNewTrialsMetric|AnalyticsTrialConversionsMetric|AnalyticsPayingCustomersMetric|AnalyticsEventMetric
     */
    protected $metric;
    /**
     * The time range a query covers: a named window ending now, or an explicit `start` and `end`. Each result echoes the absolute range it resolved to.
     *
     * @var AnalyticsPresetTimeRange|AnalyticsCustomTimeRange
     */
    protected $timeRange;
    /**
     * The width of each bucket: `hour`, `day`, `week`, `month`, or a calendar `quarter` or `year` in `timezone`, the first and last cut at the range's ends. Defaults to `day`.
     *
     * @var string|null
     */
    protected $granularity;
    /**
     * The IANA time zone that sets day, week, month, quarter and year boundaries and the start of the calendar presets, such as `Europe/Prague`. Defaults to `UTC`.
     *
     * @var string|null
     */
    protected $timezone;
    /**
     * Up to 10 conditions every row must meet; none keeps everything.
     *
     * @var list<AnalyticsMetricFilter>|null
     */
    protected $filters;
    /**
     * What a metric is split or narrowed by; `kind` says which.
     *
     * @var AnalyticsStoreDimension|AnalyticsProductDimension|AnalyticsStoreProductDimension|AnalyticsCountryDimension|AnalyticsBillingPeriodDimension|AnalyticsPaywallDimension|AnalyticsPlacementDimension|AnalyticsOfferDimension|AnalyticsAcquisitionSourceDimension|AnalyticsPlanDimension|AnalyticsTraitDimension|AnalyticsPropertyDimension|AnalyticsCohortDimension|AnalyticsGroupDimension
     */
    protected $split;
    /**
     * An earlier period to also measure, returned as `previousTotal` and each group's (and, with a `secondSplit`, each cell's and margin's) `previousValues`: `previous_period`, the period of the same length just before the range, bucket by bucket in order; or `previous_year`, the same dates a year earlier, each bucket beside the one a year before it (the same day or month; for weeks the week 52 weeks before, so it starts on the same weekday). None unless given; a `comparisonRange` takes its place.
     *
     * @var string|null
     */
    protected $comparison;
    /**
     * @var AnalyticsMetricComparisonRange
     */
    protected $comparisonRange;
    /**
     * Whether each bucket counts from the range's start through it: money, counts, first times and sums add up, and `paying_customers`, `unique_people`, `unique_sessions`, `unique_groups`, `weekly_active` and `monthly_active` count each person, session or group once, in the first bucket they show in, so the last bucket is everyone over the range. Not for the balances `mrr`, `active_subscriptions` and `active_trials`, nor for statistics other than `sum`. Defaults to false.
     *
     * @var bool|null
     */
    protected $isCumulative;
    /**
     * How many groups of a split to return, biggest first, 1 to 50; the rest are summed under `$other`. Defaults to 10. Bins of a trait are all returned.
     *
     * @var int|null
     */
    protected $limit;
    /**
     * What a metric is split or narrowed by; `kind` says which.
     *
     * @var AnalyticsStoreDimension|AnalyticsProductDimension|AnalyticsStoreProductDimension|AnalyticsCountryDimension|AnalyticsBillingPeriodDimension|AnalyticsPaywallDimension|AnalyticsPlacementDimension|AnalyticsOfferDimension|AnalyticsAcquisitionSourceDimension|AnalyticsPlanDimension|AnalyticsTraitDimension|AnalyticsPropertyDimension|AnalyticsCohortDimension|AnalyticsGroupDimension
     */
    protected $secondSplit;
    /**
     * How many groups of `secondSplit` to return, biggest first by that dimension's own totals, 1 to 10; the rest are summed under `$other`. `limit` times this is at most 50. Defaults to 5.
     *
     * @var int|null
     */
    protected $secondLimit;
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
     * What to measure: MRR and its movements, revenue, refunds, subscriptions and trials, paying customers, or one of the project's own events; `kind` says which.
     *
     * @return AnalyticsMrrMetric|AnalyticsRevenueMetric|AnalyticsNewMrrMetric|AnalyticsExpansionMrrMetric|AnalyticsReactivationMrrMetric|AnalyticsContractionMrrMetric|AnalyticsChurnedMrrMetric|AnalyticsNetNewMrrMetric|AnalyticsRefundsMetric|AnalyticsActiveSubscriptionsMetric|AnalyticsActiveTrialsMetric|AnalyticsNewSubscriptionsMetric|AnalyticsChurnedSubscriptionsMetric|AnalyticsNewTrialsMetric|AnalyticsTrialConversionsMetric|AnalyticsPayingCustomersMetric|AnalyticsEventMetric
     */
    public function getMetric()
    {
        return $this->metric;
    }
    /**
     * What to measure: MRR and its movements, revenue, refunds, subscriptions and trials, paying customers, or one of the project's own events; `kind` says which.
     *
     * @param AnalyticsMrrMetric|AnalyticsRevenueMetric|AnalyticsNewMrrMetric|AnalyticsExpansionMrrMetric|AnalyticsReactivationMrrMetric|AnalyticsContractionMrrMetric|AnalyticsChurnedMrrMetric|AnalyticsNetNewMrrMetric|AnalyticsRefundsMetric|AnalyticsActiveSubscriptionsMetric|AnalyticsActiveTrialsMetric|AnalyticsNewSubscriptionsMetric|AnalyticsChurnedSubscriptionsMetric|AnalyticsNewTrialsMetric|AnalyticsTrialConversionsMetric|AnalyticsPayingCustomersMetric|AnalyticsEventMetric $metric
     *
     * @return self
     */
    public function setMetric($metric): self
    {
        $this->initialized['metric'] = true;
        $this->metric = $metric;
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
     * The width of each bucket: `hour`, `day`, `week`, `month`, or a calendar `quarter` or `year` in `timezone`, the first and last cut at the range's ends. Defaults to `day`.
     *
     * @return string|null
     */
    public function getGranularity(): ?string
    {
        return $this->granularity;
    }
    /**
     * The width of each bucket: `hour`, `day`, `week`, `month`, or a calendar `quarter` or `year` in `timezone`, the first and last cut at the range's ends. Defaults to `day`.
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
     * The IANA time zone that sets day, week, month, quarter and year boundaries and the start of the calendar presets, such as `Europe/Prague`. Defaults to `UTC`.
     *
     * @return string|null
     */
    public function getTimezone(): ?string
    {
        return $this->timezone;
    }
    /**
     * The IANA time zone that sets day, week, month, quarter and year boundaries and the start of the calendar presets, such as `Europe/Prague`. Defaults to `UTC`.
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
     * Up to 10 conditions every row must meet; none keeps everything.
     *
     * @return list<AnalyticsMetricFilter>|null
     */
    public function getFilters(): ?array
    {
        return $this->filters;
    }
    /**
     * Up to 10 conditions every row must meet; none keeps everything.
     *
     * @param list<AnalyticsMetricFilter>|null $filters
     *
     * @return self
     */
    public function setFilters(?array $filters): self
    {
        $this->initialized['filters'] = true;
        $this->filters = $filters;
        return $this;
    }
    /**
     * What a metric is split or narrowed by; `kind` says which.
     *
     * @return AnalyticsStoreDimension|AnalyticsProductDimension|AnalyticsStoreProductDimension|AnalyticsCountryDimension|AnalyticsBillingPeriodDimension|AnalyticsPaywallDimension|AnalyticsPlacementDimension|AnalyticsOfferDimension|AnalyticsAcquisitionSourceDimension|AnalyticsPlanDimension|AnalyticsTraitDimension|AnalyticsPropertyDimension|AnalyticsCohortDimension|AnalyticsGroupDimension
     */
    public function getSplit()
    {
        return $this->split;
    }
    /**
     * What a metric is split or narrowed by; `kind` says which.
     *
     * @param AnalyticsStoreDimension|AnalyticsProductDimension|AnalyticsStoreProductDimension|AnalyticsCountryDimension|AnalyticsBillingPeriodDimension|AnalyticsPaywallDimension|AnalyticsPlacementDimension|AnalyticsOfferDimension|AnalyticsAcquisitionSourceDimension|AnalyticsPlanDimension|AnalyticsTraitDimension|AnalyticsPropertyDimension|AnalyticsCohortDimension|AnalyticsGroupDimension $split
     *
     * @return self
     */
    public function setSplit($split): self
    {
        $this->initialized['split'] = true;
        $this->split = $split;
        return $this;
    }
    /**
     * An earlier period to also measure, returned as `previousTotal` and each group's (and, with a `secondSplit`, each cell's and margin's) `previousValues`: `previous_period`, the period of the same length just before the range, bucket by bucket in order; or `previous_year`, the same dates a year earlier, each bucket beside the one a year before it (the same day or month; for weeks the week 52 weeks before, so it starts on the same weekday). None unless given; a `comparisonRange` takes its place.
     *
     * @return string|null
     */
    public function getComparison(): ?string
    {
        return $this->comparison;
    }
    /**
     * An earlier period to also measure, returned as `previousTotal` and each group's (and, with a `secondSplit`, each cell's and margin's) `previousValues`: `previous_period`, the period of the same length just before the range, bucket by bucket in order; or `previous_year`, the same dates a year earlier, each bucket beside the one a year before it (the same day or month; for weeks the week 52 weeks before, so it starts on the same weekday). None unless given; a `comparisonRange` takes its place.
     *
     * @param string|null $comparison
     *
     * @return self
     */
    public function setComparison(?string $comparison): self
    {
        $this->initialized['comparison'] = true;
        $this->comparison = $comparison;
        return $this;
    }
    /**
     * @return AnalyticsMetricComparisonRange
     */
    public function getComparisonRange(): AnalyticsMetricComparisonRange
    {
        return $this->comparisonRange;
    }
    /**
     * @param AnalyticsMetricComparisonRange $comparisonRange
     *
     * @return self
     */
    public function setComparisonRange(AnalyticsMetricComparisonRange $comparisonRange): self
    {
        $this->initialized['comparisonRange'] = true;
        $this->comparisonRange = $comparisonRange;
        return $this;
    }
    /**
     * Whether each bucket counts from the range's start through it: money, counts, first times and sums add up, and `paying_customers`, `unique_people`, `unique_sessions`, `unique_groups`, `weekly_active` and `monthly_active` count each person, session or group once, in the first bucket they show in, so the last bucket is everyone over the range. Not for the balances `mrr`, `active_subscriptions` and `active_trials`, nor for statistics other than `sum`. Defaults to false.
     *
     * @return bool|null
     */
    public function getIsCumulative(): ?bool
    {
        return $this->isCumulative;
    }
    /**
     * Whether each bucket counts from the range's start through it: money, counts, first times and sums add up, and `paying_customers`, `unique_people`, `unique_sessions`, `unique_groups`, `weekly_active` and `monthly_active` count each person, session or group once, in the first bucket they show in, so the last bucket is everyone over the range. Not for the balances `mrr`, `active_subscriptions` and `active_trials`, nor for statistics other than `sum`. Defaults to false.
     *
     * @param bool|null $isCumulative
     *
     * @return self
     */
    public function setIsCumulative(?bool $isCumulative): self
    {
        $this->initialized['isCumulative'] = true;
        $this->isCumulative = $isCumulative;
        return $this;
    }
    /**
     * How many groups of a split to return, biggest first, 1 to 50; the rest are summed under `$other`. Defaults to 10. Bins of a trait are all returned.
     *
     * @return int|null
     */
    public function getLimit(): ?int
    {
        return $this->limit;
    }
    /**
     * How many groups of a split to return, biggest first, 1 to 50; the rest are summed under `$other`. Defaults to 10. Bins of a trait are all returned.
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
     * What a metric is split or narrowed by; `kind` says which.
     *
     * @return AnalyticsStoreDimension|AnalyticsProductDimension|AnalyticsStoreProductDimension|AnalyticsCountryDimension|AnalyticsBillingPeriodDimension|AnalyticsPaywallDimension|AnalyticsPlacementDimension|AnalyticsOfferDimension|AnalyticsAcquisitionSourceDimension|AnalyticsPlanDimension|AnalyticsTraitDimension|AnalyticsPropertyDimension|AnalyticsCohortDimension|AnalyticsGroupDimension
     */
    public function getSecondSplit()
    {
        return $this->secondSplit;
    }
    /**
     * What a metric is split or narrowed by; `kind` says which.
     *
     * @param AnalyticsStoreDimension|AnalyticsProductDimension|AnalyticsStoreProductDimension|AnalyticsCountryDimension|AnalyticsBillingPeriodDimension|AnalyticsPaywallDimension|AnalyticsPlacementDimension|AnalyticsOfferDimension|AnalyticsAcquisitionSourceDimension|AnalyticsPlanDimension|AnalyticsTraitDimension|AnalyticsPropertyDimension|AnalyticsCohortDimension|AnalyticsGroupDimension $secondSplit
     *
     * @return self
     */
    public function setSecondSplit($secondSplit): self
    {
        $this->initialized['secondSplit'] = true;
        $this->secondSplit = $secondSplit;
        return $this;
    }
    /**
     * How many groups of `secondSplit` to return, biggest first by that dimension's own totals, 1 to 10; the rest are summed under `$other`. `limit` times this is at most 50. Defaults to 5.
     *
     * @return int|null
     */
    public function getSecondLimit(): ?int
    {
        return $this->secondLimit;
    }
    /**
     * How many groups of `secondSplit` to return, biggest first by that dimension's own totals, 1 to 10; the rest are summed under `$other`. `limit` times this is at most 50. Defaults to 5.
     *
     * @param int|null $secondLimit
     *
     * @return self
     */
    public function setSecondLimit(?int $secondLimit): self
    {
        $this->initialized['secondLimit'] = true;
        $this->secondLimit = $secondLimit;
        return $this;
    }
}