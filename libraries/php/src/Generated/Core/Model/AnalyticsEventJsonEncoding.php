<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsEventJsonEncoding
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
    protected $captureId;
    /**
     * @var array<string, mixed>
     */
    protected $context;
    /**
     * @var string|null
     */
    protected $distinctId;
    /**
     * @var string
     */
    protected $eventId;
    /**
     * @var string
     */
    protected $eventName;
    /**
     * @var string
     */
    protected $identityMode;
    /**
     * @var string|null
     */
    protected $personId;
    /**
     * @var string|null
     */
    protected $previousDistinctId;
    /**
     * @var string
     */
    protected $processedAt;
    /**
     * @var array<string, mixed>
     */
    protected $properties;
    /**
     * @var string
     */
    protected $receivedAt;
    /**
     * @var string
     */
    protected $requestId;
    /**
     * @var string
     */
    protected $source;
    /**
     * @var string
     */
    protected $timestamp;
    /**
     * @return string
     */
    public function getCaptureId(): string
    {
        return $this->captureId;
    }
    /**
     * @param string $captureId
     *
     * @return self
     */
    public function setCaptureId(string $captureId): self
    {
        $this->initialized['captureId'] = true;
        $this->captureId = $captureId;
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
     * @return string|null
     */
    public function getDistinctId(): ?string
    {
        return $this->distinctId;
    }
    /**
     * @param string|null $distinctId
     *
     * @return self
     */
    public function setDistinctId(?string $distinctId): self
    {
        $this->initialized['distinctId'] = true;
        $this->distinctId = $distinctId;
        return $this;
    }
    /**
     * @return string
     */
    public function getEventId(): string
    {
        return $this->eventId;
    }
    /**
     * @param string $eventId
     *
     * @return self
     */
    public function setEventId(string $eventId): self
    {
        $this->initialized['eventId'] = true;
        $this->eventId = $eventId;
        return $this;
    }
    /**
     * @return string
     */
    public function getEventName(): string
    {
        return $this->eventName;
    }
    /**
     * @param string $eventName
     *
     * @return self
     */
    public function setEventName(string $eventName): self
    {
        $this->initialized['eventName'] = true;
        $this->eventName = $eventName;
        return $this;
    }
    /**
     * @return string
     */
    public function getIdentityMode(): string
    {
        return $this->identityMode;
    }
    /**
     * @param string $identityMode
     *
     * @return self
     */
    public function setIdentityMode(string $identityMode): self
    {
        $this->initialized['identityMode'] = true;
        $this->identityMode = $identityMode;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getPersonId(): ?string
    {
        return $this->personId;
    }
    /**
     * @param string|null $personId
     *
     * @return self
     */
    public function setPersonId(?string $personId): self
    {
        $this->initialized['personId'] = true;
        $this->personId = $personId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getPreviousDistinctId(): ?string
    {
        return $this->previousDistinctId;
    }
    /**
     * @param string|null $previousDistinctId
     *
     * @return self
     */
    public function setPreviousDistinctId(?string $previousDistinctId): self
    {
        $this->initialized['previousDistinctId'] = true;
        $this->previousDistinctId = $previousDistinctId;
        return $this;
    }
    /**
     * @return string
     */
    public function getProcessedAt(): string
    {
        return $this->processedAt;
    }
    /**
     * @param string $processedAt
     *
     * @return self
     */
    public function setProcessedAt(string $processedAt): self
    {
        $this->initialized['processedAt'] = true;
        $this->processedAt = $processedAt;
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
     * @return string
     */
    public function getReceivedAt(): string
    {
        return $this->receivedAt;
    }
    /**
     * @param string $receivedAt
     *
     * @return self
     */
    public function setReceivedAt(string $receivedAt): self
    {
        $this->initialized['receivedAt'] = true;
        $this->receivedAt = $receivedAt;
        return $this;
    }
    /**
     * @return string
     */
    public function getRequestId(): string
    {
        return $this->requestId;
    }
    /**
     * @param string $requestId
     *
     * @return self
     */
    public function setRequestId(string $requestId): self
    {
        $this->initialized['requestId'] = true;
        $this->requestId = $requestId;
        return $this;
    }
    /**
     * @return string
     */
    public function getSource(): string
    {
        return $this->source;
    }
    /**
     * @param string $source
     *
     * @return self
     */
    public function setSource(string $source): self
    {
        $this->initialized['source'] = true;
        $this->source = $source;
        return $this;
    }
    /**
     * @return string
     */
    public function getTimestamp(): string
    {
        return $this->timestamp;
    }
    /**
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