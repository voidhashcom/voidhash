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
     * The delivery's id, `wh_del_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the delivery belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The webhook it is sent to.
     *
     * @var string
     */
    protected $webhookId;
    /**
     * One of the webhook event types, or `test.ping` for a test delivery.
     *
     * @var string
     */
    protected $eventType;
    /**
     * The event body sent to the webhook.
     *
     * @var mixed
     */
    protected $payload;
    /**
     * `failed` is retried at `nextAttemptAt`; `exhausted` ran out of attempts and is sent again only when you retry it.
     *
     * @var string
     */
    protected $status;
    /**
     * Attempts made so far.
     *
     * @var int
     */
    protected $attemptCount;
    /**
     * Attempts Voidhash makes, with growing pauses, before the delivery is `exhausted`.
     *
     * @var int
     */
    protected $maxAttempts;
    /**
     * When the event happened, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $eventOccurredAt;
    /**
     * When the next attempt is due; null when none is scheduled.
     *
     * @var string|null
     */
    protected $nextAttemptAt;
    /**
     * When the delivery succeeded or ran out of attempts; null until then.
     *
     * @var string|null
     */
    protected $completedAt;
    /**
     * When the delivery was created, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * Every attempt made for the delivery, oldest first.
     *
     * @var list<WebhookDeliveryAttemptJsonEncoding>
     */
    protected $attempts;
    /**
     * The delivery's id, `wh_del_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The delivery's id, `wh_del_...`.
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
     * The project the delivery belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the delivery belongs to.
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
     * The webhook it is sent to.
     *
     * @return string
     */
    public function getWebhookId(): string
    {
        return $this->webhookId;
    }
    /**
     * The webhook it is sent to.
     *
     * @param string $webhookId
     *
     * @return self
     */
    public function setWebhookId(string $webhookId): self
    {
        $this->initialized['webhookId'] = true;
        $this->webhookId = $webhookId;
        return $this;
    }
    /**
     * One of the webhook event types, or `test.ping` for a test delivery.
     *
     * @return string
     */
    public function getEventType(): string
    {
        return $this->eventType;
    }
    /**
     * One of the webhook event types, or `test.ping` for a test delivery.
     *
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
     * The event body sent to the webhook.
     *
     * @return mixed
     */
    public function getPayload()
    {
        return $this->payload;
    }
    /**
     * The event body sent to the webhook.
     *
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
     * `failed` is retried at `nextAttemptAt`; `exhausted` ran out of attempts and is sent again only when you retry it.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `failed` is retried at `nextAttemptAt`; `exhausted` ran out of attempts and is sent again only when you retry it.
     *
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
     * Attempts made so far.
     *
     * @return int
     */
    public function getAttemptCount(): int
    {
        return $this->attemptCount;
    }
    /**
     * Attempts made so far.
     *
     * @param int $attemptCount
     *
     * @return self
     */
    public function setAttemptCount(int $attemptCount): self
    {
        $this->initialized['attemptCount'] = true;
        $this->attemptCount = $attemptCount;
        return $this;
    }
    /**
     * Attempts Voidhash makes, with growing pauses, before the delivery is `exhausted`.
     *
     * @return int
     */
    public function getMaxAttempts(): int
    {
        return $this->maxAttempts;
    }
    /**
     * Attempts Voidhash makes, with growing pauses, before the delivery is `exhausted`.
     *
     * @param int $maxAttempts
     *
     * @return self
     */
    public function setMaxAttempts(int $maxAttempts): self
    {
        $this->initialized['maxAttempts'] = true;
        $this->maxAttempts = $maxAttempts;
        return $this;
    }
    /**
     * When the event happened, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getEventOccurredAt(): string
    {
        return $this->eventOccurredAt;
    }
    /**
     * When the event happened, as an ISO 8601 timestamp.
     *
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
     * When the next attempt is due; null when none is scheduled.
     *
     * @return string|null
     */
    public function getNextAttemptAt(): ?string
    {
        return $this->nextAttemptAt;
    }
    /**
     * When the next attempt is due; null when none is scheduled.
     *
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
     * When the delivery succeeded or ran out of attempts; null until then.
     *
     * @return string|null
     */
    public function getCompletedAt(): ?string
    {
        return $this->completedAt;
    }
    /**
     * When the delivery succeeded or ran out of attempts; null until then.
     *
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
     * When the delivery was created, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the delivery was created, as an ISO 8601 timestamp.
     *
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
     * Every attempt made for the delivery, oldest first.
     *
     * @return list<WebhookDeliveryAttemptJsonEncoding>
     */
    public function getAttempts(): array
    {
        return $this->attempts;
    }
    /**
     * Every attempt made for the delivery, oldest first.
     *
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
}