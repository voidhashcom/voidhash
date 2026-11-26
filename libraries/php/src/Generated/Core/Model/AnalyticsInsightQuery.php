<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsInsightQuery
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
     * Fields to split the result by. Not supported by any built-in insight yet; leave it out.
     *
     * @var list<AnalyticsBreakdown>|null
     */
    protected $breakdowns;
    /**
     * What an amount counts of a charge: `gross`, everything the customer paid; `net_of_tax`, that without tax; `proceeds`, that without tax and the store's commission.
     *
     * @var string
     */
    protected $basis;
    /**
     * A filter: one comparison, or `and`, `or` and `not` combining others.
     *
     * @var AnalyticsFilterPredicate|AnalyticsFilterAnd|AnalyticsFilterOr|AnalyticsFilterNot
     */
    protected $filter;
    /**
     * The width of each point of the sparkline: `hour`, `day`, `week`, `month`, `quarter` or `year`. Defaults to `day`; only `revenue` supports `hour`.
     *
     * @var string|null
     */
    protected $granularity;
    /**
     * The built-in insight. Money: `revenue` (purchases and renewals minus refunds), `mrr` (monthly recurring revenue, after tax and before the store's commission), `arr` (12 × MRR), `churned_revenue`, `new_mrr`, `expansion_mrr`, `contraction_mrr`, `reactivation_mrr`, `net_new_mrr`, `arpu`, `arppu` and `subscriber_lifetime_value`. Percentages: `mrr_growth_rate`, `churn_rate`, `retention`, `active_subscribers_growth` and `trial_conversion_rate`. Counts: `person_count`, `new_persons`, `active_subscriptions`, `active_trials`, `new_subscriptions`, `churned_subscriptions`, `trials` and `trial_conversions`.
     *
     * @var string
     */
    protected $insightId;
    /**
     * A name you choose for the query, returned on its result.
     *
     * @var string
     */
    protected $key;
    /**
     * Reserved for breakdowns. No built-in insight supports it yet; one with a limit fails with `invalid_report_request`.
     *
     * @var int|null
     */
    protected $limit;
    /**
     * The time range a query covers: a named window ending now, or an explicit `start` and `end`. Each result echoes the absolute range it resolved to.
     *
     * @var AnalyticsPresetTimeRange|AnalyticsCustomTimeRange
     */
    protected $timeRange;
    /**
     * The IANA time zone that sets day, week and month boundaries and the start of `today`, `mtd`, `qtd` and `ytd`, such as `Europe/Prague`. Offsets such as `+01:00` are rejected. Defaults to `UTC`.
     *
     * @var string|null
     */
    protected $timezone;
    /**
     * Fields to split the result by. Not supported by any built-in insight yet; leave it out.
     *
     * @return list<AnalyticsBreakdown>|null
     */
    public function getBreakdowns(): ?array
    {
        return $this->breakdowns;
    }
    /**
     * Fields to split the result by. Not supported by any built-in insight yet; leave it out.
     *
     * @param list<AnalyticsBreakdown>|null $breakdowns
     *
     * @return self
     */
    public function setBreakdowns(?array $breakdowns): self
    {
        $this->initialized['breakdowns'] = true;
        $this->breakdowns = $breakdowns;
        return $this;
    }
    /**
     * What an amount counts of a charge: `gross`, everything the customer paid; `net_of_tax`, that without tax; `proceeds`, that without tax and the store's commission.
     *
     * @return string
     */
    public function getBasis(): string
    {
        return $this->basis;
    }
    /**
     * What an amount counts of a charge: `gross`, everything the customer paid; `net_of_tax`, that without tax; `proceeds`, that without tax and the store's commission.
     *
     * @param string $basis
     *
     * @return self
     */
    public function setBasis(string $basis): self
    {
        $this->initialized['basis'] = true;
        $this->basis = $basis;
        return $this;
    }
    /**
     * A filter: one comparison, or `and`, `or` and `not` combining others.
     *
     * @return AnalyticsFilterPredicate|AnalyticsFilterAnd|AnalyticsFilterOr|AnalyticsFilterNot
     */
    public function getFilter()
    {
        return $this->filter;
    }
    /**
     * A filter: one comparison, or `and`, `or` and `not` combining others.
     *
     * @param AnalyticsFilterPredicate|AnalyticsFilterAnd|AnalyticsFilterOr|AnalyticsFilterNot $filter
     *
     * @return self
     */
    public function setFilter($filter): self
    {
        $this->initialized['filter'] = true;
        $this->filter = $filter;
        return $this;
    }
    /**
     * The width of each point of the sparkline: `hour`, `day`, `week`, `month`, `quarter` or `year`. Defaults to `day`; only `revenue` supports `hour`.
     *
     * @return string|null
     */
    public function getGranularity(): ?string
    {
        return $this->granularity;
    }
    /**
     * The width of each point of the sparkline: `hour`, `day`, `week`, `month`, `quarter` or `year`. Defaults to `day`; only `revenue` supports `hour`.
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
     * The built-in insight. Money: `revenue` (purchases and renewals minus refunds), `mrr` (monthly recurring revenue, after tax and before the store's commission), `arr` (12 × MRR), `churned_revenue`, `new_mrr`, `expansion_mrr`, `contraction_mrr`, `reactivation_mrr`, `net_new_mrr`, `arpu`, `arppu` and `subscriber_lifetime_value`. Percentages: `mrr_growth_rate`, `churn_rate`, `retention`, `active_subscribers_growth` and `trial_conversion_rate`. Counts: `person_count`, `new_persons`, `active_subscriptions`, `active_trials`, `new_subscriptions`, `churned_subscriptions`, `trials` and `trial_conversions`.
     *
     * @return string
     */
    public function getInsightId(): string
    {
        return $this->insightId;
    }
    /**
     * The built-in insight. Money: `revenue` (purchases and renewals minus refunds), `mrr` (monthly recurring revenue, after tax and before the store's commission), `arr` (12 × MRR), `churned_revenue`, `new_mrr`, `expansion_mrr`, `contraction_mrr`, `reactivation_mrr`, `net_new_mrr`, `arpu`, `arppu` and `subscriber_lifetime_value`. Percentages: `mrr_growth_rate`, `churn_rate`, `retention`, `active_subscribers_growth` and `trial_conversion_rate`. Counts: `person_count`, `new_persons`, `active_subscriptions`, `active_trials`, `new_subscriptions`, `churned_subscriptions`, `trials` and `trial_conversions`.
     *
     * @param string $insightId
     *
     * @return self
     */
    public function setInsightId(string $insightId): self
    {
        $this->initialized['insightId'] = true;
        $this->insightId = $insightId;
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
     * Reserved for breakdowns. No built-in insight supports it yet; one with a limit fails with `invalid_report_request`.
     *
     * @return int|null
     */
    public function getLimit(): ?int
    {
        return $this->limit;
    }
    /**
     * Reserved for breakdowns. No built-in insight supports it yet; one with a limit fails with `invalid_report_request`.
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
     * The IANA time zone that sets day, week and month boundaries and the start of `today`, `mtd`, `qtd` and `ytd`, such as `Europe/Prague`. Offsets such as `+01:00` are rejected. Defaults to `UTC`.
     *
     * @return string|null
     */
    public function getTimezone(): ?string
    {
        return $this->timezone;
    }
    /**
     * The IANA time zone that sets day, week and month boundaries and the start of `today`, `mtd`, `qtd` and `ytd`, such as `Europe/Prague`. Offsets such as `+01:00` are rejected. Defaults to `UTC`.
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
}