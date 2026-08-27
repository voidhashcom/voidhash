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
     * @var int
     */
    protected $accepted;
    /**
     * @var int
     */
    protected $rejected;
    /**
     * @return int
     */
    public function getAccepted(): int
    {
        return $this->accepted;
    }
    /**
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
     * @return int
     */
    public function getRejected(): int
    {
        return $this->rejected;
    }
    /**
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