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
     * The event's id, set by its sender; an event delivered again with the same id is the same event.
     *
     * @var string
     */
    protected $id;
    /**
     * The id of the project that stored the event.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The event's name; built-in events start with `$`.
     *
     * @var string
     */
    protected $name;
    /**
     * When the event happened, by the clock of the device that captured it, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $timestamp;
    /**
     * The distinct ID the event was sent for.
     *
     * @var string
     */
    protected $distinctId;
    /**
     * For an identify event, the distinct ID it linked to `distinctId`, such as an anonymous one; else null.
     *
     * @var string|null
     */
    protected $previousDistinctId;
    /**
     * The id of the person the event belongs to; null when it has none.
     *
     * @var string|null
     */
    protected $personId;
    /**
     * `full` events create or update a person; `personless` events are counted without one.
     *
     * @var string
     */
    protected $identityMode;
    /**
     * The SDK session the event was captured in; null when the client reported none.
     *
     * @var string|null
     */
    protected $sessionId;
    /**
     * The event's properties, as sent.
     *
     * @var array<string, mixed>
     */
    protected $properties;
    /**
     * What the SDK reported about the device and app, such as OS and app version.
     *
     * @var array<string, mixed>
     */
    protected $context;
    /**
     * Where the event came from: `sdk` (a client SDK), `revenue` (a verified purchase) or `internal` (Voidhash itself).
     *
     * @var string
     */
    protected $source;
    /**
     * How far the event can be trusted: `untrusted_sdk` for what a client sent, `trusted_revenue` for verified purchases, `trusted_internal` for events Voidhash emitted.
     *
     * @var string
     */
    protected $trustClass;
    /**
     * When the client sent the batch carrying the event; null for events Voidhash emitted. `sentAt - timestamp` is how long the device held it, such as while offline.
     *
     * @var string|null
     */
    protected $sentAt;
    /**
     * When Voidhash accepted the event, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $receivedAt;
    /**
     * When the event was stored, as an ISO 8601 timestamp; `processedAt - receivedAt` is how long it waited to be processed. Listing order follows it.
     *
     * @var string
     */
    protected $processedAt;
    /**
     * The id of the capture batch that carried the event, for support.
     *
     * @var string
     */
    protected $captureId;
    /**
     * The id of the request that carried the event, for support.
     *
     * @var string
     */
    protected $requestId;
    /**
     * The event's id, set by its sender; an event delivered again with the same id is the same event.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The event's id, set by its sender; an event delivered again with the same id is the same event.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The id of the project that stored the event.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The id of the project that stored the event.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * The event's name; built-in events start with `$`.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The event's name; built-in events start with `$`.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * When the event happened, by the clock of the device that captured it, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getTimestamp(): string
    {
        return $this->timestamp;
    }
    /**
     * When the event happened, by the clock of the device that captured it, as an ISO 8601 timestamp.
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
    /**
     * The distinct ID the event was sent for.
     *
     * @return string
     */
    public function getDistinctId(): string
    {
        return $this->distinctId;
    }
    /**
     * The distinct ID the event was sent for.
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
     * For an identify event, the distinct ID it linked to `distinctId`, such as an anonymous one; else null.
     *
     * @return string|null
     */
    public function getPreviousDistinctId(): ?string
    {
        return $this->previousDistinctId;
    }
    /**
     * For an identify event, the distinct ID it linked to `distinctId`, such as an anonymous one; else null.
     *
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
     * The id of the person the event belongs to; null when it has none.
     *
     * @return string|null
     */
    public function getPersonId(): ?string
    {
        return $this->personId;
    }
    /**
     * The id of the person the event belongs to; null when it has none.
     *
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
     * `full` events create or update a person; `personless` events are counted without one.
     *
     * @return string
     */
    public function getIdentityMode(): string
    {
        return $this->identityMode;
    }
    /**
     * `full` events create or update a person; `personless` events are counted without one.
     *
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
     * The SDK session the event was captured in; null when the client reported none.
     *
     * @return string|null
     */
    public function getSessionId(): ?string
    {
        return $this->sessionId;
    }
    /**
     * The SDK session the event was captured in; null when the client reported none.
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
     * The event's properties, as sent.
     *
     * @return array<string, mixed>
     */
    public function getProperties(): iterable
    {
        return $this->properties;
    }
    /**
     * The event's properties, as sent.
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
     * What the SDK reported about the device and app, such as OS and app version.
     *
     * @return array<string, mixed>
     */
    public function getContext(): iterable
    {
        return $this->context;
    }
    /**
     * What the SDK reported about the device and app, such as OS and app version.
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
     * Where the event came from: `sdk` (a client SDK), `revenue` (a verified purchase) or `internal` (Voidhash itself).
     *
     * @return string
     */
    public function getSource(): string
    {
        return $this->source;
    }
    /**
     * Where the event came from: `sdk` (a client SDK), `revenue` (a verified purchase) or `internal` (Voidhash itself).
     *
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
     * How far the event can be trusted: `untrusted_sdk` for what a client sent, `trusted_revenue` for verified purchases, `trusted_internal` for events Voidhash emitted.
     *
     * @return string
     */
    public function getTrustClass(): string
    {
        return $this->trustClass;
    }
    /**
     * How far the event can be trusted: `untrusted_sdk` for what a client sent, `trusted_revenue` for verified purchases, `trusted_internal` for events Voidhash emitted.
     *
     * @param string $trustClass
     *
     * @return self
     */
    public function setTrustClass(string $trustClass): self
    {
        $this->initialized['trustClass'] = true;
        $this->trustClass = $trustClass;
        return $this;
    }
    /**
     * When the client sent the batch carrying the event; null for events Voidhash emitted. `sentAt - timestamp` is how long the device held it, such as while offline.
     *
     * @return string|null
     */
    public function getSentAt(): ?string
    {
        return $this->sentAt;
    }
    /**
     * When the client sent the batch carrying the event; null for events Voidhash emitted. `sentAt - timestamp` is how long the device held it, such as while offline.
     *
     * @param string|null $sentAt
     *
     * @return self
     */
    public function setSentAt(?string $sentAt): self
    {
        $this->initialized['sentAt'] = true;
        $this->sentAt = $sentAt;
        return $this;
    }
    /**
     * When Voidhash accepted the event, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getReceivedAt(): string
    {
        return $this->receivedAt;
    }
    /**
     * When Voidhash accepted the event, as an ISO 8601 timestamp.
     *
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
     * When the event was stored, as an ISO 8601 timestamp; `processedAt - receivedAt` is how long it waited to be processed. Listing order follows it.
     *
     * @return string
     */
    public function getProcessedAt(): string
    {
        return $this->processedAt;
    }
    /**
     * When the event was stored, as an ISO 8601 timestamp; `processedAt - receivedAt` is how long it waited to be processed. Listing order follows it.
     *
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
     * The id of the capture batch that carried the event, for support.
     *
     * @return string
     */
    public function getCaptureId(): string
    {
        return $this->captureId;
    }
    /**
     * The id of the capture batch that carried the event, for support.
     *
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
     * The id of the request that carried the event, for support.
     *
     * @return string
     */
    public function getRequestId(): string
    {
        return $this->requestId;
    }
    /**
     * The id of the request that carried the event, for support.
     *
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
}