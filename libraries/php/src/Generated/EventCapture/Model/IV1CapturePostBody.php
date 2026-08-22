<?php

namespace Voidhash\Generated\EventCapture\Model;

class IV1CapturePostBody
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
     * @var mixed
     */
    protected $uuid;
    /**
     * @var mixed
     */
    protected $event;
    /**
     * @var array<string, mixed>
     */
    protected $context;
    /**
     * @var array<string, mixed>
     */
    protected $properties;
    /**
     * @var mixed
     */
    protected $distinctId;
    /**
     * @var mixed|null
     */
    protected $sessionId;
    /**
     * @var mixed|null
     */
    protected $timestamp;
    /**
     * @var mixed
     */
    protected $sentAt;
    /**
     * @var mixed
     */
    protected $token;
    /**
     * @return mixed
     */
    public function getUuid()
    {
        return $this->uuid;
    }
    /**
     * @param mixed $uuid
     *
     * @return self
     */
    public function setUuid($uuid): self
    {
        $this->initialized['uuid'] = true;
        $this->uuid = $uuid;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getEvent()
    {
        return $this->event;
    }
    /**
     * @param mixed $event
     *
     * @return self
     */
    public function setEvent($event): self
    {
        $this->initialized['event'] = true;
        $this->event = $event;
        return $this;
    }
    /**
     * @return array<string, mixed>
     */
    public function getContext(): iterable
    {
        return $this->context;
    }
    /**
     * @param array<string, mixed> $context
     *
     * @return self
     */
    public function setContext(iterable $context): self
    {
        $this->initialized['context'] = true;
        $this->context = $context;
        return $this;
    }
    /**
     * @return array<string, mixed>
     */
    public function getProperties(): iterable
    {
        return $this->properties;
    }
    /**
     * @param array<string, mixed> $properties
     *
     * @return self
     */
    public function setProperties(iterable $properties): self
    {
        $this->initialized['properties'] = true;
        $this->properties = $properties;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getDistinctId()
    {
        return $this->distinctId;
    }
    /**
     * @param mixed $distinctId
     *
     * @return self
     */
    public function setDistinctId($distinctId): self
    {
        $this->initialized['distinctId'] = true;
        $this->distinctId = $distinctId;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getSessionId()
    {
        return $this->sessionId;
    }
    /**
     * @param mixed $sessionId
     *
     * @return self
     */
    public function setSessionId($sessionId): self
    {
        $this->initialized['sessionId'] = true;
        $this->sessionId = $sessionId;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getTimestamp()
    {
        return $this->timestamp;
    }
    /**
     * @param mixed $timestamp
     *
     * @return self
     */
    public function setTimestamp($timestamp): self
    {
        $this->initialized['timestamp'] = true;
        $this->timestamp = $timestamp;
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