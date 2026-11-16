<?php

namespace Voidhash\Generated\EventCapture\Model;

class CaptureEvent
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
     * The event's id: a UUID you generate once and send unchanged on every retry, so the event is stored once.
     *
     * @var string
     */
    protected $uuid;
    /**
     * The event's name, such as `paywall_viewed`.
     *
     * @var string
     */
    protected $event;
    /**
     * Facts about the app and device that sent it, such as `platform` and `app_version`.
     *
     * @var array<string, mixed>
     */
    protected $context;
    /**
     * The event's properties, as JSON values. `$set` and `$set_once` hold traits to set on the person.
     *
     * @var array<string, mixed>
     */
    protected $properties;
    /**
     * The distinct id of the person it happened to.
     *
     * @var string
     */
    protected $distinctId;
    /**
     * The session it belongs to, when the sender tracks sessions.
     *
     * @var string|null
     */
    protected $sessionId;
    /**
     * When it happened on the device, as an ISO 8601 timestamp. Voidhash corrects it by how far the device's clock is off, measured with `sent_at`.
     *
     * @var string
     */
    protected $timestamp;
    /**
     * The event's id: a UUID you generate once and send unchanged on every retry, so the event is stored once.
     *
     * @return string
     */
    public function getUuid(): string
    {
        return $this->uuid;
    }
    /**
     * The event's id: a UUID you generate once and send unchanged on every retry, so the event is stored once.
     *
     * @param string $uuid
     *
     * @return self
     */
    public function setUuid(string $uuid): self
    {
        $this->initialized['uuid'] = true;
        $this->uuid = $uuid;
        return $this;
    }
    /**
     * The event's name, such as `paywall_viewed`.
     *
     * @return string
     */
    public function getEvent(): string
    {
        return $this->event;
    }
    /**
     * The event's name, such as `paywall_viewed`.
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
     * Facts about the app and device that sent it, such as `platform` and `app_version`.
     *
     * @return array<string, mixed>
     */
    public function getContext(): iterable
    {
        return $this->context;
    }
    /**
     * Facts about the app and device that sent it, such as `platform` and `app_version`.
     *
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
     * The event's properties, as JSON values. `$set` and `$set_once` hold traits to set on the person.
     *
     * @return array<string, mixed>
     */
    public function getProperties(): iterable
    {
        return $this->properties;
    }
    /**
     * The event's properties, as JSON values. `$set` and `$set_once` hold traits to set on the person.
     *
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
     * The distinct id of the person it happened to.
     *
     * @return string
     */
    public function getDistinctId(): string
    {
        return $this->distinctId;
    }
    /**
     * The distinct id of the person it happened to.
     *
     * @param string $distinctId
     *
     * @return self
     */
    public function setDistinctId(string $distinctId): self
    {
        $this->initialized['distinctId'] = true;
        $this->distinctId = $distinctId;
        return $this;
    }
    /**
     * The session it belongs to, when the sender tracks sessions.
     *
     * @return string|null
     */
    public function getSessionId(): ?string
    {
        return $this->sessionId;
    }
    /**
     * The session it belongs to, when the sender tracks sessions.
     *
     * @param string|null $sessionId
     *
     * @return self
     */
    public function setSessionId(?string $sessionId): self
    {
        $this->initialized['sessionId'] = true;
        $this->sessionId = $sessionId;
        return $this;
    }
    /**
     * When it happened on the device, as an ISO 8601 timestamp. Voidhash corrects it by how far the device's clock is off, measured with `sent_at`.
     *
     * @return string
     */
    public function getTimestamp(): string
    {
        return $this->timestamp;
    }
    /**
     * When it happened on the device, as an ISO 8601 timestamp. Voidhash corrects it by how far the device's clock is off, measured with `sent_at`.
     *
     * @param string $timestamp
     *
     * @return self
     */
    public function setTimestamp(string $timestamp): self
    {
        $this->initialized['timestamp'] = true;
        $this->timestamp = $timestamp;
        return $this;
    }
}