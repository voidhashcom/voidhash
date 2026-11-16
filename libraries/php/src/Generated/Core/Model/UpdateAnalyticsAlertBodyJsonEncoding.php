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
     * The new event to count or watch; for `failure_share`, the event of a failed attempt.
     *
     * @var string|null
     */
    protected $eventName;
    /**
     * The new event of an attempt that worked, for `failure_share` alerts only.
     *
     * @var string|null
     */
    protected $successEventName;
    /**
     * The new window in hours: `1`, `6`, `24` or `168`.
     *
     * @var int|null
     */
    protected $windowHours;
    /**
     * The new threshold: a whole count of at least 1 for `event_count`, a share between 0 and 1 for the others.
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
     * The new event to count or watch; for `failure_share`, the event of a failed attempt.
     *
     * @return string|null
     */
    public function getEventName(): ?string
    {
        return $this->eventName;
    }
    /**
     * The new event to count or watch; for `failure_share`, the event of a failed attempt.
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
     * The new window in hours: `1`, `6`, `24` or `168`.
     *
     * @return int|null
     */
    public function getWindowHours(): ?int
    {
        return $this->windowHours;
    }
    /**
     * The new window in hours: `1`, `6`, `24` or `168`.
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
     * The new threshold: a whole count of at least 1 for `event_count`, a share between 0 and 1 for the others.
     *
     * @return float|null
     */
    public function getThreshold(): ?float
    {
        return $this->threshold;
    }
    /**
     * The new threshold: a whole count of at least 1 for `event_count`, a share between 0 and 1 for the others.
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