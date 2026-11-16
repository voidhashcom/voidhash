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
     * What the alert watches: `event_count` fires when an event happens at least `threshold` times to at least `minPeople` people; `failure_share` fires when the share of attempts that failed is clearly above `threshold`, an attempt being `eventName` (the failure) or `successEventName`; `volume_drop` fires when an event falls by at least `threshold` against the median of the same window in the four weeks before.
     *
     * @var string
     */
    protected $kind;
    /**
     * The event to count or watch, up to 256 characters; for `failure_share`, the event of a failed attempt.
     *
     * @var string
     */
    protected $eventName;
    /**
     * The event of an attempt that worked, different from `eventName`. Required for `failure_share`, and only allowed there.
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
     * When the alert fires: for `event_count` a whole count of at least 1; for `failure_share` and `volume_drop` a share greater than 0 and less than 1, such as 0.2 for 20%.
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
     * The event to count or watch, up to 256 characters; for `failure_share`, the event of a failed attempt.
     *
     * @return string
     */
    public function getEventName(): string
    {
        return $this->eventName;
    }
    /**
     * The event to count or watch, up to 256 characters; for `failure_share`, the event of a failed attempt.
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
     * When the alert fires: for `event_count` a whole count of at least 1; for `failure_share` and `volume_drop` a share greater than 0 and less than 1, such as 0.2 for 20%.
     *
     * @return float
     */
    public function getThreshold(): float
    {
        return $this->threshold;
    }
    /**
     * When the alert fires: for `event_count` a whole count of at least 1; for `failure_share` and `volume_drop` a share greater than 0 and less than 1, such as 0.2 for 20%.
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