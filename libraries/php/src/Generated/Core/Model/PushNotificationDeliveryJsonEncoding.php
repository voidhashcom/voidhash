<?php

namespace Voidhash\Generated\Core\Model;

class PushNotificationDeliveryJsonEncoding
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
     * The delivery's id, `push_del_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The person the device belongs to.
     *
     * @var string
     */
    protected $personId;
    /**
     * The push service: `fcm` for Firebase Cloud Messaging, `apns` for the Apple Push Notification service.
     *
     * @var string
     */
    protected $provider;
    /**
     * Where the delivery to one device stands: `pending` before its first attempt, `in_progress` during one, `succeeded`, `failed` (retried later unless the push service refused it for good, such as for an unregistered device), or `exhausted` when its retries ran out or the message was too large.
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
     * How many attempts are made before the delivery is `exhausted`.
     *
     * @var int
     */
    protected $maxAttempts;
    /**
     * When the next retry is due, as an ISO 8601 timestamp; null when none is.
     *
     * @var string|null
     */
    protected $nextAttemptAt;
    /**
     * When the delivery settled, as an ISO 8601 timestamp; null while it can still be retried.
     *
     * @var string|null
     */
    protected $completedAt;
    /**
     * Why the last failed attempt failed, such as `PushUnregisteredError` or `PushTransientError`; null without one.
     *
     * @var string|null
     */
    protected $lastError;
    /**
     * The push service's id for the message; null until it is delivered.
     *
     * @var string|null
     */
    protected $providerMessageId;
    /**
     * When the delivery was queued, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The delivery's id, `push_del_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The delivery's id, `push_del_...`.
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
     * The person the device belongs to.
     *
     * @return string
     */
    public function getPersonId(): string
    {
        return $this->personId;
    }
    /**
     * The person the device belongs to.
     *
     * @param string $personId
     *
     * @return self
     */
    public function setPersonId(string $personId): self
    {
        $this->initialized['personId'] = true;
        $this->personId = $personId;
        return $this;
    }
    /**
     * The push service: `fcm` for Firebase Cloud Messaging, `apns` for the Apple Push Notification service.
     *
     * @return string
     */
    public function getProvider(): string
    {
        return $this->provider;
    }
    /**
     * The push service: `fcm` for Firebase Cloud Messaging, `apns` for the Apple Push Notification service.
     *
     * @param string $provider
     *
     * @return self
     */
    public function setProvider(string $provider): self
    {
        $this->initialized['provider'] = true;
        $this->provider = $provider;
        return $this;
    }
    /**
     * Where the delivery to one device stands: `pending` before its first attempt, `in_progress` during one, `succeeded`, `failed` (retried later unless the push service refused it for good, such as for an unregistered device), or `exhausted` when its retries ran out or the message was too large.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * Where the delivery to one device stands: `pending` before its first attempt, `in_progress` during one, `succeeded`, `failed` (retried later unless the push service refused it for good, such as for an unregistered device), or `exhausted` when its retries ran out or the message was too large.
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
     * How many attempts are made before the delivery is `exhausted`.
     *
     * @return int
     */
    public function getMaxAttempts(): int
    {
        return $this->maxAttempts;
    }
    /**
     * How many attempts are made before the delivery is `exhausted`.
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
     * When the next retry is due, as an ISO 8601 timestamp; null when none is.
     *
     * @return string|null
     */
    public function getNextAttemptAt(): ?string
    {
        return $this->nextAttemptAt;
    }
    /**
     * When the next retry is due, as an ISO 8601 timestamp; null when none is.
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
     * When the delivery settled, as an ISO 8601 timestamp; null while it can still be retried.
     *
     * @return string|null
     */
    public function getCompletedAt(): ?string
    {
        return $this->completedAt;
    }
    /**
     * When the delivery settled, as an ISO 8601 timestamp; null while it can still be retried.
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
     * Why the last failed attempt failed, such as `PushUnregisteredError` or `PushTransientError`; null without one.
     *
     * @return string|null
     */
    public function getLastError(): ?string
    {
        return $this->lastError;
    }
    /**
     * Why the last failed attempt failed, such as `PushUnregisteredError` or `PushTransientError`; null without one.
     *
     * @param string|null $lastError
     *
     * @return self
     */
    public function setLastError(?string $lastError): self
    {
        $this->initialized['lastError'] = true;
        $this->lastError = $lastError;
        return $this;
    }
    /**
     * The push service's id for the message; null until it is delivered.
     *
     * @return string|null
     */
    public function getProviderMessageId(): ?string
    {
        return $this->providerMessageId;
    }
    /**
     * The push service's id for the message; null until it is delivered.
     *
     * @param string|null $providerMessageId
     *
     * @return self
     */
    public function setProviderMessageId(?string $providerMessageId): self
    {
        $this->initialized['providerMessageId'] = true;
        $this->providerMessageId = $providerMessageId;
        return $this;
    }
    /**
     * When the delivery was queued, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the delivery was queued, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
}