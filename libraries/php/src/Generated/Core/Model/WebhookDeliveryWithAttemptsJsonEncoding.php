<?php

namespace Voidhash\Generated\Core\Model;

class WebhookDeliveryWithAttemptsJsonEncoding
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
    protected $attemptCount;
    /**
     * @var list<WebhookDeliveryAttemptJsonEncoding>
     */
    protected $attempts;
    /**
     * @var string|null
     */
    protected $completedAt;
    /**
     * @var string|null
     */
    protected $createdAt;
    /**
     * @var string
     */
    protected $eventOccurredAt;
    /**
     * @var string
     */
    protected $eventType;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var mixed
     */
    protected $maxAttempts;
    /**
     * @var string|null
     */
    protected $nextAttemptAt;
    /**
     * @var mixed
     */
    protected $payload;
    /**
     * @var string
     */
    protected $projectId;
    /**
     * @var string
     */
    protected $status;
    /**
     * @var string
     */
    protected $webhookEndpointId;
    /**
     * @return mixed
     */
    public function getAttemptCount()
    {
        return $this->attemptCount;
    }
    /**
     * @param mixed $attemptCount
     *
     * @return self
     */
    public function setAttemptCount($attemptCount): self
    {
        $this->initialized['attemptCount'] = true;
        $this->attemptCount = $attemptCount;
        return $this;
    }
    /**
     * @return list<WebhookDeliveryAttemptJsonEncoding>
     */
    public function getAttempts(): array
    {
        return $this->attempts;
    }
    /**
     * @param list<WebhookDeliveryAttemptJsonEncoding> $attempts
     *
     * @return self
     */
    public function setAttempts(array $attempts): self
    {
        $this->initialized['attempts'] = true;
        $this->attempts = $attempts;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getCompletedAt(): ?string
    {
        return $this->completedAt;
    }
    /**
     * @param string|null $completedAt
     *
     * @return self
     */
    public function setCompletedAt(?string $completedAt): self
    {
        $this->initialized['completedAt'] = true;
        $this->completedAt = $completedAt;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * @return string
     */
    public function getEventOccurredAt(): string
    {
        return $this->eventOccurredAt;
    }
    /**
     * @param string $eventOccurredAt
     *
     * @return self
     */
    public function setEventOccurredAt(string $eventOccurredAt): self
    {
        $this->initialized['eventOccurredAt'] = true;
        $this->eventOccurredAt = $eventOccurredAt;
        return $this;
    }
    /**
     * @return string
     */
    public function getEventType(): string
    {
        return $this->eventType;
    }
    /**
     * @param string $eventType
     *
     * @return self
     */
    public function setEventType(string $eventType): self
    {
        $this->initialized['eventType'] = true;
        $this->eventType = $eventType;
        return $this;
    }
    /**
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
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
     * @return mixed
     */
    public function getMaxAttempts()
    {
        return $this->maxAttempts;
    }
    /**
     * @param mixed $maxAttempts
     *
     * @return self
     */
    public function setMaxAttempts($maxAttempts): self
    {
        $this->initialized['maxAttempts'] = true;
        $this->maxAttempts = $maxAttempts;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getNextAttemptAt(): ?string
    {
        return $this->nextAttemptAt;
    }
    /**
     * @param string|null $nextAttemptAt
     *
     * @return self
     */
    public function setNextAttemptAt(?string $nextAttemptAt): self
    {
        $this->initialized['nextAttemptAt'] = true;
        $this->nextAttemptAt = $nextAttemptAt;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getPayload()
    {
        return $this->payload;
    }
    /**
     * @param mixed $payload
     *
     * @return self
     */
    public function setPayload($payload): self
    {
        $this->initialized['payload'] = true;
        $this->payload = $payload;
        return $this;
    }
    /**
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
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
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * @return string
     */
    public function getWebhookEndpointId(): string
    {
        return $this->webhookEndpointId;
    }
    /**
     * @param string $webhookEndpointId
     *
     * @return self
     */
    public function setWebhookEndpointId(string $webhookEndpointId): self
    {
        $this->initialized['webhookEndpointId'] = true;
        $this->webhookEndpointId = $webhookEndpointId;
        return $this;
    }
}