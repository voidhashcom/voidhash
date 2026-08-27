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
     * @var string
     */
    protected $sentAt;
    /**
     * @var string|null
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
     * @return string
     */
    public function getSentAt(): string
    {
        return $this->sentAt;
    }
    /**
     * @param string $sentAt
     *
     * @return self
     */
    public function setSentAt(string $sentAt): self
    {
        $this->initialized['sentAt'] = true;
        $this->sentAt = $sentAt;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getToken(): ?string
    {
        return $this->token;
    }
    /**
     * @param string|null $token
     *
     * @return self
     */
    public function setToken(?string $token): self
    {
        $this->initialized['token'] = true;
        $this->token = $token;
        return $this;
    }
}