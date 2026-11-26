<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsAlertJsonEncoding
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
     * The alert's id, `alert_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project whose events the alert watches.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The alert's name, shown in Studio and in its notices.
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
     * The event counted or watched; for `failure_share`, the event of a failed attempt; null for a metric alert.
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
     * For a money metric (`mrr`, its movements, `revenue` and `refunds`), the ISO 4217 code its `threshold`, `value` and `baseline` are in, as integer minor units: the organization's reporting currency when the alert was saved, unless it named another. The alert keeps it when the organization's reporting currency changes, and is measured in it. Null for a count and an event alert.
     *
     * @var string|null
     */
    protected $currency;
    /**
     * The event of an attempt that worked, for `failure_share`; null for the other kinds.
     *
     * @var string|null
     */
    protected $successEventName;
    /**
     * The trailing window each check reads, in hours: `1`, `6`, `24` or `168` (7 days) for an event alert; `24`, `168` or `720` (30 days) for a metric alert.
     *
     * @var int
     */
    protected $windowHours;
    /**
     * When the alert fires: a count of at least 1 for `event_count`; a share between 0 and 1 for `failure_share` and `volume_drop`, such as 0.2 for 20%; for `metric_threshold` the metric's value, a money metric's in integer minor units of `currency` (500000 for 5,000.00 euros, 5000 for 5,000 yen) and a count's as a whole number; for `metric_change` a share of the compared value, such as 0.1 for 10%.
     *
     * @var float
     */
    protected $threshold;
    /**
     * The distinct people an `event_count` alert's events must come from, so one device's retries stay quiet; null for the other kinds.
     *
     * @var int|null
     */
    protected $minPeople;
    /**
     * Whether the alert is checked; a turned-off alert is not.
     *
     * @var bool
     */
    protected $isEnabled;
    /**
     * How the alert stands after its latest check: `pending` until its first check after it was created, changed or turned on; `ok`; `firing`; `not_enough_volume` when too few events happened in the window to judge, or a metric alert's compared value is too small; `not_enough_history` when a `volume_drop` alert's event has fewer than two earlier weeks to compare with, or a metric alert's purchases were not tracked before the window it compares with; or `cannot_measure` when a metric alert can no longer be measured as it stands, such as a filter naming a cohort deleted since, with the reason in `problem`: it stays so until a check can measure it again, usually once the alert is changed. More states may be added: treat one you don't know as unknown rather than failing.
     *
     * @var string
     */
    protected $state;
    /**
     * What the latest check read: a count; for `failure_share` a share between 0 and 1; for a metric alert the metric, a money metric's in integer minor units of `currency` and a count's as a number. Null before the first check, and while a metric's result was withheld for narrowing to fewer than five people.
     *
     * @var float|null
     */
    protected $value;
    /**
     * What the latest check compared with: for `volume_drop` the usual count, the median of the same window in earlier weeks; for `metric_change` the metric over the compared window, money in integer minor units of `currency`. Null until it has one, and for the other kinds.
     *
     * @var float|null
     */
    protected $baseline;
    /**
     * How many of the four earlier weeks a `volume_drop` alert could read at its latest check; it needs 2 to judge. Null for the other kinds and before the first check.
     *
     * @var int|null
     */
    protected $baselineWeeks;
    /**
     * Why a metric alert cannot be measured, in plain words, while its `state` is `cannot_measure`; null in every other state.
     *
     * @var string|null
     */
    protected $problem;
    /**
     * The end of the latest window checked, as an ISO 8601 timestamp; null before the first check.
     *
     * @var string|null
     */
    protected $checkedThrough;
    /**
     * When the alert started firing, as an ISO 8601 timestamp; null while it is not firing.
     *
     * @var string|null
     */
    protected $firingSince;
    /**
     * When the alert was created, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The alert's id, `alert_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The alert's id, `alert_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The project whose events the alert watches.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project whose events the alert watches.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * The alert's name, shown in Studio and in its notices.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The alert's name, shown in Studio and in its notices.
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
     * The event counted or watched; for `failure_share`, the event of a failed attempt; null for a metric alert.
     *
     * @return string|null
     */
    public function getEventName(): ?string
    {
        return $this->eventName;
    }
    /**
     * The event counted or watched; for `failure_share`, the event of a failed attempt; null for a metric alert.
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
     * For a money metric (`mrr`, its movements, `revenue` and `refunds`), the ISO 4217 code its `threshold`, `value` and `baseline` are in, as integer minor units: the organization's reporting currency when the alert was saved, unless it named another. The alert keeps it when the organization's reporting currency changes, and is measured in it. Null for a count and an event alert.
     *
     * @return string|null
     */
    public function getCurrency(): ?string
    {
        return $this->currency;
    }
    /**
     * For a money metric (`mrr`, its movements, `revenue` and `refunds`), the ISO 4217 code its `threshold`, `value` and `baseline` are in, as integer minor units: the organization's reporting currency when the alert was saved, unless it named another. The alert keeps it when the organization's reporting currency changes, and is measured in it. Null for a count and an event alert.
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
     * The event of an attempt that worked, for `failure_share`; null for the other kinds.
     *
     * @return string|null
     */
    public function getSuccessEventName(): ?string
    {
        return $this->successEventName;
    }
    /**
     * The event of an attempt that worked, for `failure_share`; null for the other kinds.
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
     * The trailing window each check reads, in hours: `1`, `6`, `24` or `168` (7 days) for an event alert; `24`, `168` or `720` (30 days) for a metric alert.
     *
     * @return int
     */
    public function getWindowHours(): int
    {
        return $this->windowHours;
    }
    /**
     * The trailing window each check reads, in hours: `1`, `6`, `24` or `168` (7 days) for an event alert; `24`, `168` or `720` (30 days) for a metric alert.
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
     * When the alert fires: a count of at least 1 for `event_count`; a share between 0 and 1 for `failure_share` and `volume_drop`, such as 0.2 for 20%; for `metric_threshold` the metric's value, a money metric's in integer minor units of `currency` (500000 for 5,000.00 euros, 5000 for 5,000 yen) and a count's as a whole number; for `metric_change` a share of the compared value, such as 0.1 for 10%.
     *
     * @return float
     */
    public function getThreshold(): float
    {
        return $this->threshold;
    }
    /**
     * When the alert fires: a count of at least 1 for `event_count`; a share between 0 and 1 for `failure_share` and `volume_drop`, such as 0.2 for 20%; for `metric_threshold` the metric's value, a money metric's in integer minor units of `currency` (500000 for 5,000.00 euros, 5000 for 5,000 yen) and a count's as a whole number; for `metric_change` a share of the compared value, such as 0.1 for 10%.
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
     * The distinct people an `event_count` alert's events must come from, so one device's retries stay quiet; null for the other kinds.
     *
     * @return int|null
     */
    public function getMinPeople(): ?int
    {
        return $this->minPeople;
    }
    /**
     * The distinct people an `event_count` alert's events must come from, so one device's retries stay quiet; null for the other kinds.
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
     * Whether the alert is checked; a turned-off alert is not.
     *
     * @return bool
     */
    public function getIsEnabled(): bool
    {
        return $this->isEnabled;
    }
    /**
     * Whether the alert is checked; a turned-off alert is not.
     *
     * @param bool $isEnabled
     *
     * @return self
     */
    public function setIsEnabled(bool $isEnabled): self
    {
        $this->initialized['isEnabled'] = true;
        $this->isEnabled = $isEnabled;
        return $this;
    }
    /**
     * How the alert stands after its latest check: `pending` until its first check after it was created, changed or turned on; `ok`; `firing`; `not_enough_volume` when too few events happened in the window to judge, or a metric alert's compared value is too small; `not_enough_history` when a `volume_drop` alert's event has fewer than two earlier weeks to compare with, or a metric alert's purchases were not tracked before the window it compares with; or `cannot_measure` when a metric alert can no longer be measured as it stands, such as a filter naming a cohort deleted since, with the reason in `problem`: it stays so until a check can measure it again, usually once the alert is changed. More states may be added: treat one you don't know as unknown rather than failing.
     *
     * @return string
     */
    public function getState(): string
    {
        return $this->state;
    }
    /**
     * How the alert stands after its latest check: `pending` until its first check after it was created, changed or turned on; `ok`; `firing`; `not_enough_volume` when too few events happened in the window to judge, or a metric alert's compared value is too small; `not_enough_history` when a `volume_drop` alert's event has fewer than two earlier weeks to compare with, or a metric alert's purchases were not tracked before the window it compares with; or `cannot_measure` when a metric alert can no longer be measured as it stands, such as a filter naming a cohort deleted since, with the reason in `problem`: it stays so until a check can measure it again, usually once the alert is changed. More states may be added: treat one you don't know as unknown rather than failing.
     *
     * @param string $state
     *
     * @return self
     */
    public function setState(string $state): self
    {
        $this->initialized['state'] = true;
        $this->state = $state;
        return $this;
    }
    /**
     * What the latest check read: a count; for `failure_share` a share between 0 and 1; for a metric alert the metric, a money metric's in integer minor units of `currency` and a count's as a number. Null before the first check, and while a metric's result was withheld for narrowing to fewer than five people.
     *
     * @return float|null
     */
    public function getValue(): ?float
    {
        return $this->value;
    }
    /**
     * What the latest check read: a count; for `failure_share` a share between 0 and 1; for a metric alert the metric, a money metric's in integer minor units of `currency` and a count's as a number. Null before the first check, and while a metric's result was withheld for narrowing to fewer than five people.
     *
     * @param float|null $value
     *
     * @return self
     */
    public function setValue(?float $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
    /**
     * What the latest check compared with: for `volume_drop` the usual count, the median of the same window in earlier weeks; for `metric_change` the metric over the compared window, money in integer minor units of `currency`. Null until it has one, and for the other kinds.
     *
     * @return float|null
     */
    public function getBaseline(): ?float
    {
        return $this->baseline;
    }
    /**
     * What the latest check compared with: for `volume_drop` the usual count, the median of the same window in earlier weeks; for `metric_change` the metric over the compared window, money in integer minor units of `currency`. Null until it has one, and for the other kinds.
     *
     * @param float|null $baseline
     *
     * @return self
     */
    public function setBaseline(?float $baseline): self
    {
        $this->initialized['baseline'] = true;
        $this->baseline = $baseline;
        return $this;
    }
    /**
     * How many of the four earlier weeks a `volume_drop` alert could read at its latest check; it needs 2 to judge. Null for the other kinds and before the first check.
     *
     * @return int|null
     */
    public function getBaselineWeeks(): ?int
    {
        return $this->baselineWeeks;
    }
    /**
     * How many of the four earlier weeks a `volume_drop` alert could read at its latest check; it needs 2 to judge. Null for the other kinds and before the first check.
     *
     * @param int|null $baselineWeeks
     *
     * @return self
     */
    public function setBaselineWeeks(?int $baselineWeeks): self
    {
        $this->initialized['baselineWeeks'] = true;
        $this->baselineWeeks = $baselineWeeks;
        return $this;
    }
    /**
     * Why a metric alert cannot be measured, in plain words, while its `state` is `cannot_measure`; null in every other state.
     *
     * @return string|null
     */
    public function getProblem(): ?string
    {
        return $this->problem;
    }
    /**
     * Why a metric alert cannot be measured, in plain words, while its `state` is `cannot_measure`; null in every other state.
     *
     * @param string|null $problem
     *
     * @return self
     */
    public function setProblem(?string $problem): self
    {
        $this->initialized['problem'] = true;
        $this->problem = $problem;
        return $this;
    }
    /**
     * The end of the latest window checked, as an ISO 8601 timestamp; null before the first check.
     *
     * @return string|null
     */
    public function getCheckedThrough(): ?string
    {
        return $this->checkedThrough;
    }
    /**
     * The end of the latest window checked, as an ISO 8601 timestamp; null before the first check.
     *
     * @param string|null $checkedThrough
     *
     * @return self
     */
    public function setCheckedThrough(?string $checkedThrough): self
    {
        $this->initialized['checkedThrough'] = true;
        $this->checkedThrough = $checkedThrough;
        return $this;
    }
    /**
     * When the alert started firing, as an ISO 8601 timestamp; null while it is not firing.
     *
     * @return string|null
     */
    public function getFiringSince(): ?string
    {
        return $this->firingSince;
    }
    /**
     * When the alert started firing, as an ISO 8601 timestamp; null while it is not firing.
     *
     * @param string|null $firingSince
     *
     * @return self
     */
    public function setFiringSince(?string $firingSince): self
    {
        $this->initialized['firingSince'] = true;
        $this->firingSince = $firingSince;
        return $this;
    }
    /**
     * When the alert was created, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the alert was created, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
}