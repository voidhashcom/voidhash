<?php

namespace Voidhash\Generated\Core\Model;

class UpdateAnalyticsAlertBodyJsonEncoding
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
     * The new name, 1 to 255 characters. Renaming doesn't reset the alert's state.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The new event to count or watch; for `failure_share`, the event of a failed attempt. Event alerts only.
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
     * The currency the alert's `threshold` is in, for a money metric only; send `threshold` with it, which is read in it. Omitted, the alert keeps its own, or takes the organization's reporting currency when its metric becomes money.
     *
     * @var string|null
     */
    protected $currency;
    /**
     * The new event of an attempt that worked, for `failure_share` alerts only.
     *
     * @var string|null
     */
    protected $successEventName;
    /**
     * The new window in hours: `1`, `6`, `24` or `168` for an event alert, `24`, `168` or `720` for a metric alert.
     *
     * @var int|null
     */
    protected $windowHours;
    /**
     * The new threshold, read as `CreateAnalyticsAlertBody.threshold` is for the alert's kind.
     *
     * @var float|null
     */
    protected $threshold;
    /**
     * The new minimum of distinct people, at least 1; for `event_count` alerts only.
     *
     * @var int|null
     */
    protected $minPeople;
    /**
     * Whether the alert is checked; `false` turns it off.
     *
     * @var bool|null
     */
    protected $isEnabled;
    /**
     * The new name, 1 to 255 characters. Renaming doesn't reset the alert's state.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The new name, 1 to 255 characters. Renaming doesn't reset the alert's state.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The new event to count or watch; for `failure_share`, the event of a failed attempt. Event alerts only.
     *
     * @return string|null
     */
    public function getEventName(): ?string
    {
        return $this->eventName;
    }
    /**
     * The new event to count or watch; for `failure_share`, the event of a failed attempt. Event alerts only.
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
     * The currency the alert's `threshold` is in, for a money metric only; send `threshold` with it, which is read in it. Omitted, the alert keeps its own, or takes the organization's reporting currency when its metric becomes money.
     *
     * @return string|null
     */
    public function getCurrency(): ?string
    {
        return $this->currency;
    }
    /**
     * The currency the alert's `threshold` is in, for a money metric only; send `threshold` with it, which is read in it. Omitted, the alert keeps its own, or takes the organization's reporting currency when its metric becomes money.
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
     * The new event of an attempt that worked, for `failure_share` alerts only.
     *
     * @return string|null
     */
    public function getSuccessEventName(): ?string
    {
        return $this->successEventName;
    }
    /**
     * The new event of an attempt that worked, for `failure_share` alerts only.
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
     * The new window in hours: `1`, `6`, `24` or `168` for an event alert, `24`, `168` or `720` for a metric alert.
     *
     * @return int|null
     */
    public function getWindowHours(): ?int
    {
        return $this->windowHours;
    }
    /**
     * The new window in hours: `1`, `6`, `24` or `168` for an event alert, `24`, `168` or `720` for a metric alert.
     *
     * @param int|null $windowHours
     *
     * @return self
     */
    public function setWindowHours(?int $windowHours): self
    {
        $this->initialized['windowHours'] = true;
        $this->windowHours = $windowHours;
        return $this;
    }
    /**
     * The new threshold, read as `CreateAnalyticsAlertBody.threshold` is for the alert's kind.
     *
     * @return float|null
     */
    public function getThreshold(): ?float
    {
        return $this->threshold;
    }
    /**
     * The new threshold, read as `CreateAnalyticsAlertBody.threshold` is for the alert's kind.
     *
     * @param float|null $threshold
     *
     * @return self
     */
    public function setThreshold(?float $threshold): self
    {
        $this->initialized['threshold'] = true;
        $this->threshold = $threshold;
        return $this;
    }
    /**
     * The new minimum of distinct people, at least 1; for `event_count` alerts only.
     *
     * @return int|null
     */
    public function getMinPeople(): ?int
    {
        return $this->minPeople;
    }
    /**
     * The new minimum of distinct people, at least 1; for `event_count` alerts only.
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
    /**
     * Whether the alert is checked; `false` turns it off.
     *
     * @return bool|null
     */
    public function getIsEnabled(): ?bool
    {
        return $this->isEnabled;
    }
    /**
     * Whether the alert is checked; `false` turns it off.
     *
     * @param bool|null $isEnabled
     *
     * @return self
     */
    public function setIsEnabled(?bool $isEnabled): self
    {
        $this->initialized['isEnabled'] = true;
        $this->isEnabled = $isEnabled;
        return $this;
    }
}