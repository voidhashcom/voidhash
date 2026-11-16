<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCohortFirstTimeCondition
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
     * @var string
     */
    protected $kind;
    /**
     * The event, by the name the app sends.
     *
     * @var string
     */
    protected $event;
    /**
     * The days, ending now, their first time falls in: 1 to 365.
     *
     * @var int
     */
    protected $withinDays;
    /**
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
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
     * The event, by the name the app sends.
     *
     * @return string
     */
    public function getEvent(): string
    {
        return $this->event;
    }
    /**
     * The event, by the name the app sends.
     *
     * @param string $event
     *
     * @return self
     */
    public function setEvent(string $event): self
    {
        $this->initialized['event'] = true;
        $this->event = $event;
        return $this;
    }
    /**
     * The days, ending now, their first time falls in: 1 to 365.
     *
     * @return int
     */
    public function getWithinDays(): int
    {
        return $this->withinDays;
    }
    /**
     * The days, ending now, their first time falls in: 1 to 365.
     *
     * @param int $withinDays
     *
     * @return self
     */
    public function setWithinDays(int $withinDays): self
    {
        $this->initialized['withinDays'] = true;
        $this->withinDays = $withinDays;
        return $this;
    }
}