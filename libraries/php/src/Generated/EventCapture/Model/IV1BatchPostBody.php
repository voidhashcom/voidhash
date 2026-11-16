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
     * The events, 1 to 100.
     *
     * @var list<CaptureEvent>
     */
    protected $events;
    /**
     * When the request was sent, as an ISO 8601 timestamp. Voidhash compares it with when the request arrived to correct the events' times.
     *
     * @var string
     */
    protected $sentAt;
    /**
     * The project's publishable key, `vh_pk_...`, for clients that cannot hold a secret. Send it or the `x-secret-key` header; a secret key here is refused.
     *
     * @var string|null
     */
    protected $token;
    /**
     * The events, 1 to 100.
     *
     * @return list<CaptureEvent>
     */
    public function getEvents(): array
    {
        return $this->events;
    }
    /**
     * The events, 1 to 100.
     *
     * @param list<CaptureEvent> $events
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
     * When the request was sent, as an ISO 8601 timestamp. Voidhash compares it with when the request arrived to correct the events' times.
     *
     * @return string
     */
    public function getSentAt(): string
    {
        return $this->sentAt;
    }
    /**
     * When the request was sent, as an ISO 8601 timestamp. Voidhash compares it with when the request arrived to correct the events' times.
     *
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
     * The project's publishable key, `vh_pk_...`, for clients that cannot hold a secret. Send it or the `x-secret-key` header; a secret key here is refused.
     *
     * @return string|null
     */
    public function getToken(): ?string
    {
        return $this->token;
    }
    /**
     * The project's publishable key, `vh_pk_...`, for clients that cannot hold a secret. Send it or the `x-secret-key` header; a secret key here is refused.
     *
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