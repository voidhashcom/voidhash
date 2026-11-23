<?php

namespace Voidhash\Generated\Core\Model;

class FunnelExclusionSteps
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
     * The event that takes a person out of the funnel.
     *
     * @var string
     */
    protected $event;
    /**
     * The step it counts after, by its index from 0.
     *
     * @var int
     */
    protected $from;
    /**
     * The step it counts before, by its index from 0; after `from`.
     *
     * @var int
     */
    protected $to;
    /**
     * The event that takes a person out of the funnel.
     *
     * @return string
     */
    public function getEvent(): string
    {
        return $this->event;
    }
    /**
     * The event that takes a person out of the funnel.
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
     * The step it counts after, by its index from 0.
     *
     * @return int
     */
    public function getFrom(): int
    {
        return $this->from;
    }
    /**
     * The step it counts after, by its index from 0.
     *
     * @param int $from
     *
     * @return self
     */
    public function setFrom(int $from): self
    {
        $this->initialized['from'] = true;
        $this->from = $from;
        return $this;
    }
    /**
     * The step it counts before, by its index from 0; after `from`.
     *
     * @return int
     */
    public function getTo(): int
    {
        return $this->to;
    }
    /**
     * The step it counts before, by its index from 0; after `from`.
     *
     * @param int $to
     *
     * @return self
     */
    public function setTo(int $to): self
    {
        $this->initialized['to'] = true;
        $this->to = $to;
        return $this;
    }
}