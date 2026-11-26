<?php

namespace Voidhash\Generated\Core\Model;

class CreateAnalyticsAlertBodyJsonEncoding
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
     * The alert's name, 1 to 255 characters.
     *
     * @var string
     */
    protected $name;
    /**
     * What the alert watches: `event_count` fires when an event happens at least `threshold` times to at least `minPeople` people; `failure_share` fires when the share of attempts that failed is clearly above `threshold`, an attempt being `eventName` (the failure) or `successEventName`; `volume_drop` fires when an event falls by at least `threshold` against the median of the same window in the four weeks before; `metric_threshold` fires when a built-in `metric` over the window is `above` or `below` `threshold`; `metric_change` fires when it changed by at least the share `threshold`, `up`, `down` or `either`, against the window before (for a flow over 24 hours, the same 24 hours a week earlier). More kinds may be added: treat one you don't know as unknown rather than failing.
     *
     * @var string
     */
    protected $kind;
    /**
     * The event to count or watch, up to 256 characters; for `failure_share`, the event of a failed attempt. Required for an event alert, and not allowed for a metric alert.
     *
     * @var string|null
     */
    protected $eventName;
    /**
     * The built-in metric a metric alert watches, with the basis of its money.
     *
     * @var AnalyticsAlertMetric
     */
    protected $metric;
    /**
     * What the metric is narrowed by, as a metric query's `filters`: up to 10, such as the App Store's store or every country but `US`. A filter the metric can't take is refused.
     *
     * @var list<AnalyticsMetricFilter>
     */
    protected $filters;
    /**
     * Which way a metric alert fires: `above` or `below` its threshold for `metric_threshold`; `up`, `down` or `either` for `metric_change`.
     *
     * @var string
     */
    protected $direction;
    /**
     * For a money metric only: the ISO 4217 code its `threshold` is in, one the organization could report in, such as `EUR`; the organization's reporting currency (USD until one is chosen) when omitted. The alert is measured in it whatever the organization reports in later.
     *
     * @var string|null
     */
    protected $currency;
    /**
     * The event of an attempt that worked, different from `eventName`. Required for `failure_share`, and only allowed there.
     *
     * @var string|null
     */
    protected $successEventName;
    /**
     * The trailing window each check reads, in hours: `1`, `6`, `24` or `168` (7 days) for an event alert; `24`, `168` or `720` (30 days) for a metric alert. A threshold on a balance (MRR, active subscriptions or trials) reads it as it stands at each check and takes `24`.
     *
     * @var int
     */
    protected $windowHours;
    /**
     * When the alert fires: for `event_count` a whole count of at least 1; for `failure_share` and `volume_drop` a share greater than 0 and less than 1, such as 0.2 for 20%; for `metric_threshold` the metric's value, 0 or more but for `net_new_mrr`: a money metric's (`mrr`, its movements, `revenue`, `refunds`) in integer minor units of `currency` (500000 for 5,000.00 euros, 5000 for 5,000 yen), a count's as a whole number; for `metric_change` a share above 0 of the compared value, at most 1 for `down` and 10 otherwise. A change compared with less than 20 subscriptions, trials or people, or 10,000 minor units of money (100.00, or 10,000 in a currency without cents), says `not_enough_volume`.
     *
     * @var float
     */
    protected $threshold;
    /**
     * The distinct people an `event_count` alert's events must come from: at least 1, and 2 when omitted. Only allowed for `event_count`.
     *
     * @var int|null
     */
    protected $minPeople;
    /**
     * The alert's name, 1 to 255 characters.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The alert's name, 1 to 255 characters.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * What the alert watches: `event_count` fires when an event happens at least `threshold` times to at least `minPeople` people; `failure_share` fires when the share of attempts that failed is clearly above `threshold`, an attempt being `eventName` (the failure) or `successEventName`; `volume_drop` fires when an event falls by at least `threshold` against the median of the same window in the four weeks before; `metric_threshold` fires when a built-in `metric` over the window is `above` or `below` `threshold`; `metric_change` fires when it changed by at least the share `threshold`, `up`, `down` or `either`, against the window before (for a flow over 24 hours, the same 24 hours a week earlier). More kinds may be added: treat one you don't know as unknown rather than failing.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What the alert watches: `event_count` fires when an event happens at least `threshold` times to at least `minPeople` people; `failure_share` fires when the share of attempts that failed is clearly above `threshold`, an attempt being `eventName` (the failure) or `successEventName`; `volume_drop` fires when an event falls by at least `threshold` against the median of the same window in the four weeks before; `metric_threshold` fires when a built-in `metric` over the window is `above` or `below` `threshold`; `metric_change` fires when it changed by at least the share `threshold`, `up`, `down` or `either`, against the window before (for a flow over 24 hours, the same 24 hours a week earlier). More kinds may be added: treat one you don't know as unknown rather than failing.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * The event to count or watch, up to 256 characters; for `failure_share`, the event of a failed attempt. Required for an event alert, and not allowed for a metric alert.
     *
     * @return string|null
     */
    public function getEventName(): ?string
    {
        return $this->eventName;
    }
    /**
     * The event to count or watch, up to 256 characters; for `failure_share`, the event of a failed attempt. Required for an event alert, and not allowed for a metric alert.
     *
     * @param string|null $eventName
     *
     * @return self
     */
    public function setEventName(?string $eventName): self
    {
        $this->initialized['eventName'] = true;
        $this->eventName = $eventName;
        return $this;
    }
    /**
     * The built-in metric a metric alert watches, with the basis of its money.
     *
     * @return AnalyticsAlertMetric
     */
    public function getMetric(): AnalyticsAlertMetric
    {
        return $this->metric;
    }
    /**
     * The built-in metric a metric alert watches, with the basis of its money.
     *
     * @param AnalyticsAlertMetric $metric
     *
     * @return self
     */
    public function setMetric(AnalyticsAlertMetric $metric): self
    {
        $this->initialized['metric'] = true;
        $this->metric = $metric;
        return $this;
    }
    /**
     * What the metric is narrowed by, as a metric query's `filters`: up to 10, such as the App Store's store or every country but `US`. A filter the metric can't take is refused.
     *
     * @return list<AnalyticsMetricFilter>
     */
    public function getFilters(): array
    {
        return $this->filters;
    }
    /**
     * What the metric is narrowed by, as a metric query's `filters`: up to 10, such as the App Store's store or every country but `US`. A filter the metric can't take is refused.
     *
     * @param list<AnalyticsMetricFilter> $filters
     *
     * @return self
     */
    public function setFilters(array $filters): self
    {
        $this->initialized['filters'] = true;
        $this->filters = $filters;
        return $this;
    }
    /**
     * Which way a metric alert fires: `above` or `below` its threshold for `metric_threshold`; `up`, `down` or `either` for `metric_change`.
     *
     * @return string
     */
    public function getDirection(): string
    {
        return $this->direction;
    }
    /**
     * Which way a metric alert fires: `above` or `below` its threshold for `metric_threshold`; `up`, `down` or `either` for `metric_change`.
     *
     * @param string $direction
     *
     * @return self
     */
    public function setDirection(string $direction): self
    {
        $this->initialized['direction'] = true;
        $this->direction = $direction;
        return $this;
    }
    /**
     * For a money metric only: the ISO 4217 code its `threshold` is in, one the organization could report in, such as `EUR`; the organization's reporting currency (USD until one is chosen) when omitted. The alert is measured in it whatever the organization reports in later.
     *
     * @return string|null
     */
    public function getCurrency(): ?string
    {
        return $this->currency;
    }
    /**
     * For a money metric only: the ISO 4217 code its `threshold` is in, one the organization could report in, such as `EUR`; the organization's reporting currency (USD until one is chosen) when omitted. The alert is measured in it whatever the organization reports in later.
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
     * The event of an attempt that worked, different from `eventName`. Required for `failure_share`, and only allowed there.
     *
     * @return string|null
     */
    public function getSuccessEventName(): ?string
    {
        return $this->successEventName;
    }
    /**
     * The event of an attempt that worked, different from `eventName`. Required for `failure_share`, and only allowed there.
     *
     * @param string|null $successEventName
     *
     * @return self
     */
    public function setSuccessEventName(?string $successEventName): self
    {
        $this->initialized['successEventName'] = true;
        $this->successEventName = $successEventName;
        return $this;
    }
    /**
     * The trailing window each check reads, in hours: `1`, `6`, `24` or `168` (7 days) for an event alert; `24`, `168` or `720` (30 days) for a metric alert. A threshold on a balance (MRR, active subscriptions or trials) reads it as it stands at each check and takes `24`.
     *
     * @return int
     */
    public function getWindowHours(): int
    {
        return $this->windowHours;
    }
    /**
     * The trailing window each check reads, in hours: `1`, `6`, `24` or `168` (7 days) for an event alert; `24`, `168` or `720` (30 days) for a metric alert. A threshold on a balance (MRR, active subscriptions or trials) reads it as it stands at each check and takes `24`.
     *
     * @param int $windowHours
     *
     * @return self
     */
    public function setWindowHours(int $windowHours): self
    {
        $this->initialized['windowHours'] = true;
        $this->windowHours = $windowHours;
        return $this;
    }
    /**
     * When the alert fires: for `event_count` a whole count of at least 1; for `failure_share` and `volume_drop` a share greater than 0 and less than 1, such as 0.2 for 20%; for `metric_threshold` the metric's value, 0 or more but for `net_new_mrr`: a money metric's (`mrr`, its movements, `revenue`, `refunds`) in integer minor units of `currency` (500000 for 5,000.00 euros, 5000 for 5,000 yen), a count's as a whole number; for `metric_change` a share above 0 of the compared value, at most 1 for `down` and 10 otherwise. A change compared with less than 20 subscriptions, trials or people, or 10,000 minor units of money (100.00, or 10,000 in a currency without cents), says `not_enough_volume`.
     *
     * @return float
     */
    public function getThreshold(): float
    {
        return $this->threshold;
    }
    /**
     * When the alert fires: for `event_count` a whole count of at least 1; for `failure_share` and `volume_drop` a share greater than 0 and less than 1, such as 0.2 for 20%; for `metric_threshold` the metric's value, 0 or more but for `net_new_mrr`: a money metric's (`mrr`, its movements, `revenue`, `refunds`) in integer minor units of `currency` (500000 for 5,000.00 euros, 5000 for 5,000 yen), a count's as a whole number; for `metric_change` a share above 0 of the compared value, at most 1 for `down` and 10 otherwise. A change compared with less than 20 subscriptions, trials or people, or 10,000 minor units of money (100.00, or 10,000 in a currency without cents), says `not_enough_volume`.
     *
     * @param float $threshold
     *
     * @return self
     */
    public function setThreshold(float $threshold): self
    {
        $this->initialized['threshold'] = true;
        $this->threshold = $threshold;
        return $this;
    }
    /**
     * The distinct people an `event_count` alert's events must come from: at least 1, and 2 when omitted. Only allowed for `event_count`.
     *
     * @return int|null
     */
    public function getMinPeople(): ?int
    {
        return $this->minPeople;
    }
    /**
     * The distinct people an `event_count` alert's events must come from: at least 1, and 2 when omitted. Only allowed for `event_count`.
     *
     * @param int|null $minPeople
     *
     * @return self
     */
    public function setMinPeople(?int $minPeople): self
    {
        $this->initialized['minPeople'] = true;
        $this->minPeople = $minPeople;
        return $this;
    }
}