<?php

namespace Voidhash\Generated\EventCapture\Model;

class IV1BatchPostBody
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
     * @var list<IV1BatchPostBodyEventsItem>
     */
    protected $events;
    /**
     * @var mixed
     */
    protected $sentAt;
    /**
     * @var mixed
     */
    protected $token;
    /**
     * @return list<IV1BatchPostBodyEventsItem>
     */
    public function getEvents(): array
    {
        return $this->events;
    }
    /**
     * @param list<IV1BatchPostBodyEventsItem> $events
     *
     * @return self
     */
    public function setEvents(array $events): self
    {
        $this->initialized['events'] = true;
        $this->events = $events;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getSentAt()
    {
        return $this->sentAt;
    }
    /**
     * @param mixed $sentAt
     *
     * @return self
     */
    public function setSentAt($sentAt): self
    {
        $this->initialized['sentAt'] = true;
        $this->sentAt = $sentAt;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getToken()
    {
        return $this->token;
    }
    /**
     * @param mixed $token
     *
     * @return self
     */
    public function setToken($token): self
    {
        $this->initialized['token'] = true;
        $this->token = $token;
        return $this;
    }
}