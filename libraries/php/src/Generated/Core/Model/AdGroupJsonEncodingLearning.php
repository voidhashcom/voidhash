<?php

namespace Voidhash\Generated\Core\Model;

class AdGroupJsonEncodingLearning
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
     * Optimization events counted toward leaving the learning phase.
     *
     * @var int
     */
    protected $events;
    /**
     * Optimization events needed to leave it.
     *
     * @var int
     */
    protected $eventsNeeded;
    /**
     * Optimization events counted toward leaving the learning phase.
     *
     * @return int
     */
    public function getEvents(): int
    {
        return $this->events;
    }
    /**
     * Optimization events counted toward leaving the learning phase.
     *
     * @param int $events
     *
     * @return self
     */
    public function setEvents(int $events): self
    {
        $this->initialized['events'] = true;
        $this->events = $events;
        return $this;
    }
    /**
     * Optimization events needed to leave it.
     *
     * @return int
     */
    public function getEventsNeeded(): int
    {
        return $this->eventsNeeded;
    }
    /**
     * Optimization events needed to leave it.
     *
     * @param int $eventsNeeded
     *
     * @return self
     */
    public function setEventsNeeded(int $eventsNeeded): self
    {
        $this->initialized['eventsNeeded'] = true;
        $this->eventsNeeded = $eventsNeeded;
        return $this;
    }
}