<?php

namespace Voidhash\Generated\EventCapture\Model;

class CaptureAcceptedResponse
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
     * How many of the events were stored.
     *
     * @var int
     */
    protected $accepted;
    /**
     * How many were not: sent while the end user withholds consent or by a bot, blocked by the project's ingest policy, or using a reserved event name.
     *
     * @var int
     */
    protected $rejected;
    /**
     * How many of the events were stored.
     *
     * @return int
     */
    public function getAccepted(): int
    {
        return $this->accepted;
    }
    /**
     * How many of the events were stored.
     *
     * @param int $accepted
     *
     * @return self
     */
    public function setAccepted(int $accepted): self
    {
        $this->initialized['accepted'] = true;
        $this->accepted = $accepted;
        return $this;
    }
    /**
     * How many were not: sent while the end user withholds consent or by a bot, blocked by the project's ingest policy, or using a reserved event name.
     *
     * @return int
     */
    public function getRejected(): int
    {
        return $this->rejected;
    }
    /**
     * How many were not: sent while the end user withholds consent or by a bot, blocked by the project's ingest policy, or using a reserved event name.
     *
     * @param int $rejected
     *
     * @return self
     */
    public function setRejected(int $rejected): self
    {
        $this->initialized['rejected'] = true;
        $this->rejected = $rejected;
        return $this;
    }
}