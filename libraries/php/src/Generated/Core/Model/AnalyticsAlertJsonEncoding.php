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
     * What the alert watches: `event_count` fires when an event happens at least `threshold` times to at least `minPeople` people; `failure_share` fires when the share of attempts that failed is clearly above `threshold`, an attempt being `eventName` (the failure) or `successEventName`; `volume_drop` fires when an event falls by at least `threshold` against the median of the same window in the four weeks before.
     *
     * @var string
     */
    protected $kind;
    /**
     * The event counted or watched; for `failure_share`, the event of a failed attempt.
     *
     * @var string
     */
    protected $eventName;
    /**
     * The event of an attempt that worked, for `failure_share`; null for the other kinds.
     *
     * @var string|null
     */
    protected $successEventName;
    /**
     * The trailing window each check reads, in hours: `1`, `6`, `24` or `168` (7 days).
     *
     * @var int
     */
    protected $windowHours;
    /**
     * When the alert fires: a count of at least 1 for `event_count`; a share between 0 and 1 for the others, such as 0.2 for 20%.
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
     * How the alert stands after its latest check: `pending` until its first check after it was created, changed or turned on; `ok`; `firing`; `not_enough_volume` when too few events happened in the window to judge; or `not_enough_history` when a `volume_drop` alert's event has fewer than two earlier weeks to compare with.
     *
     * @var string
     */
    protected $state;
    /**
     * What the latest check read: a count, or for `failure_share` a share between 0 and 1; null before the first check.
     *
     * @var float|null
     */
    protected $value;
    /**
     * The usual count a `volume_drop` alert compared with, the median of the same window in earlier weeks; null until it has one, and for the other kinds.
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
     * What the alert watches: `event_count` fires when an event happens at least `threshold` times to at least `minPeople` people; `failure_share` fires when the share of attempts that failed is clearly above `threshold`, an attempt being `eventName` (the failure) or `successEventName`; `volume_drop` fires when an event falls by at least `threshold` against the median of the same window in the four weeks before.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What the alert watches: `event_count` fires when an event happens at least `threshold` times to at least `minPeople` people; `failure_share` fires when the share of attempts that failed is clearly above `threshold`, an attempt being `eventName` (the failure) or `successEventName`; `volume_drop` fires when an event falls by at least `threshold` against the median of the same window in the four weeks before.
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
     * The event counted or watched; for `failure_share`, the event of a failed attempt.
     *
     * @return string
     */
    public function getEventName(): string
    {
        return $this->eventName;
    }
    /**
     * The event counted or watched; for `failure_share`, the event of a failed attempt.
     *
     * @param string $eventName
     *
     * @return self
     */
    public function setEventName(string $eventName): self
    {
        $this->initialized['eventName'] = true;
        $this->eventName = $eventName;
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
     * The trailing window each check reads, in hours: `1`, `6`, `24` or `168` (7 days).
     *
     * @return int
     */
    public function getWindowHours(): int
    {
        return $this->windowHours;
    }
    /**
     * The trailing window each check reads, in hours: `1`, `6`, `24` or `168` (7 days).
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
     * When the alert fires: a count of at least 1 for `event_count`; a share between 0 and 1 for the others, such as 0.2 for 20%.
     *
     * @return float
     */
    public function getThreshold(): float
    {
        return $this->threshold;
    }
    /**
     * When the alert fires: a count of at least 1 for `event_count`; a share between 0 and 1 for the others, such as 0.2 for 20%.
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
     * How the alert stands after its latest check: `pending` until its first check after it was created, changed or turned on; `ok`; `firing`; `not_enough_volume` when too few events happened in the window to judge; or `not_enough_history` when a `volume_drop` alert's event has fewer than two earlier weeks to compare with.
     *
     * @return string
     */
    public function getState(): string
    {
        return $this->state;
    }
    /**
     * How the alert stands after its latest check: `pending` until its first check after it was created, changed or turned on; `ok`; `firing`; `not_enough_volume` when too few events happened in the window to judge; or `not_enough_history` when a `volume_drop` alert's event has fewer than two earlier weeks to compare with.
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
     * What the latest check read: a count, or for `failure_share` a share between 0 and 1; null before the first check.
     *
     * @return float|null
     */
    public function getValue(): ?float
    {
        return $this->value;
    }
    /**
     * What the latest check read: a count, or for `failure_share` a share between 0 and 1; null before the first check.
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
     * The usual count a `volume_drop` alert compared with, the median of the same window in earlier weeks; null until it has one, and for the other kinds.
     *
     * @return float|null
     */
    public function getBaseline(): ?float
    {
        return $this->baseline;
    }
    /**
     * The usual count a `volume_drop` alert compared with, the median of the same window in earlier weeks; null until it has one, and for the other kinds.
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