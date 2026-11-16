<?php

namespace Voidhash\Generated\Core\Model;

class PushNotificationJsonEncoding
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
     * The push notification's id, `push_send_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * Where a push notification's deliveries stand: `pending` before the first attempt, `in_progress` while any delivery is unsettled, then `succeeded` when every device received it, `failed` when none did, `partial_failed` when some did, or `no_recipients` when it reached no device.
     *
     * @var string
     */
    protected $status;
    /**
     * What was sent: `title`, `body` and the optional fields of the send; `{}` once `isMessagePurged` is `true`.
     *
     * @var array<string, mixed>
     */
    protected $message;
    /**
     * Whether the message was erased, as it is when a person it was sent to is erased.
     *
     * @var bool
     */
    protected $isMessagePurged;
    /**
     * How many person ids the send named in `personIds`.
     *
     * @var int
     */
    protected $requestedPersonCount;
    /**
     * How many distinct ids the send named in `distinctIds`.
     *
     * @var int
     */
    protected $requestedDistinctIdCount;
    /**
     * The requested distinct ids that named no person; nothing was sent for them.
     *
     * @var list<string>
     */
    protected $unresolvedDistinctIds;
    /**
     * How many devices it goes to: the recipients' devices of an enabled push service, each counted once.
     *
     * @var int
     */
    protected $deviceCount;
    /**
     * Devices it was delivered to.
     *
     * @var int
     */
    protected $succeededCount;
    /**
     * Devices it could not be delivered to, after any retries.
     *
     * @var int
     */
    protected $failedCount;
    /**
     * Devices left out because the project has not enabled their push service.
     *
     * @var int
     */
    protected $skippedCount;
    /**
     * The `Idempotency-Key` header the send was made with; null without one.
     *
     * @var string|null
     */
    protected $idempotencyKey;
    /**
     * When the push notification was sent, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When every delivery settled, as an ISO 8601 timestamp; null while deliveries continue.
     *
     * @var string|null
     */
    protected $completedAt;
    /**
     * The push notification's id, `push_send_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The push notification's id, `push_send_...`.
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
     * Where a push notification's deliveries stand: `pending` before the first attempt, `in_progress` while any delivery is unsettled, then `succeeded` when every device received it, `failed` when none did, `partial_failed` when some did, or `no_recipients` when it reached no device.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * Where a push notification's deliveries stand: `pending` before the first attempt, `in_progress` while any delivery is unsettled, then `succeeded` when every device received it, `failed` when none did, `partial_failed` when some did, or `no_recipients` when it reached no device.
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
     * What was sent: `title`, `body` and the optional fields of the send; `{}` once `isMessagePurged` is `true`.
     *
     * @return array<string, mixed>
     */
    public function getMessage(): iterable
    {
        return $this->message;
    }
    /**
     * What was sent: `title`, `body` and the optional fields of the send; `{}` once `isMessagePurged` is `true`.
     *
     * @param array<string, mixed> $message
     *
     * @return self
     */
    public function setMessage(iterable $message): self
    {
        $this->initialized['message'] = true;
        $this->message = $message;
        return $this;
    }
    /**
     * Whether the message was erased, as it is when a person it was sent to is erased.
     *
     * @return bool
     */
    public function getIsMessagePurged(): bool
    {
        return $this->isMessagePurged;
    }
    /**
     * Whether the message was erased, as it is when a person it was sent to is erased.
     *
     * @param bool $isMessagePurged
     *
     * @return self
     */
    public function setIsMessagePurged(bool $isMessagePurged): self
    {
        $this->initialized['isMessagePurged'] = true;
        $this->isMessagePurged = $isMessagePurged;
        return $this;
    }
    /**
     * How many person ids the send named in `personIds`.
     *
     * @return int
     */
    public function getRequestedPersonCount(): int
    {
        return $this->requestedPersonCount;
    }
    /**
     * How many person ids the send named in `personIds`.
     *
     * @param int $requestedPersonCount
     *
     * @return self
     */
    public function setRequestedPersonCount(int $requestedPersonCount): self
    {
        $this->initialized['requestedPersonCount'] = true;
        $this->requestedPersonCount = $requestedPersonCount;
        return $this;
    }
    /**
     * How many distinct ids the send named in `distinctIds`.
     *
     * @return int
     */
    public function getRequestedDistinctIdCount(): int
    {
        return $this->requestedDistinctIdCount;
    }
    /**
     * How many distinct ids the send named in `distinctIds`.
     *
     * @param int $requestedDistinctIdCount
     *
     * @return self
     */
    public function setRequestedDistinctIdCount(int $requestedDistinctIdCount): self
    {
        $this->initialized['requestedDistinctIdCount'] = true;
        $this->requestedDistinctIdCount = $requestedDistinctIdCount;
        return $this;
    }
    /**
     * The requested distinct ids that named no person; nothing was sent for them.
     *
     * @return list<string>
     */
    public function getUnresolvedDistinctIds(): array
    {
        return $this->unresolvedDistinctIds;
    }
    /**
     * The requested distinct ids that named no person; nothing was sent for them.
     *
     * @param list<string> $unresolvedDistinctIds
     *
     * @return self
     */
    public function setUnresolvedDistinctIds(array $unresolvedDistinctIds): self
    {
        $this->initialized['unresolvedDistinctIds'] = true;
        $this->unresolvedDistinctIds = $unresolvedDistinctIds;
        return $this;
    }
    /**
     * How many devices it goes to: the recipients' devices of an enabled push service, each counted once.
     *
     * @return int
     */
    public function getDeviceCount(): int
    {
        return $this->deviceCount;
    }
    /**
     * How many devices it goes to: the recipients' devices of an enabled push service, each counted once.
     *
     * @param int $deviceCount
     *
     * @return self
     */
    public function setDeviceCount(int $deviceCount): self
    {
        $this->initialized['deviceCount'] = true;
        $this->deviceCount = $deviceCount;
        return $this;
    }
    /**
     * Devices it was delivered to.
     *
     * @return int
     */
    public function getSucceededCount(): int
    {
        return $this->succeededCount;
    }
    /**
     * Devices it was delivered to.
     *
     * @param int $succeededCount
     *
     * @return self
     */
    public function setSucceededCount(int $succeededCount): self
    {
        $this->initialized['succeededCount'] = true;
        $this->succeededCount = $succeededCount;
        return $this;
    }
    /**
     * Devices it could not be delivered to, after any retries.
     *
     * @return int
     */
    public function getFailedCount(): int
    {
        return $this->failedCount;
    }
    /**
     * Devices it could not be delivered to, after any retries.
     *
     * @param int $failedCount
     *
     * @return self
     */
    public function setFailedCount(int $failedCount): self
    {
        $this->initialized['failedCount'] = true;
        $this->failedCount = $failedCount;
        return $this;
    }
    /**
     * Devices left out because the project has not enabled their push service.
     *
     * @return int
     */
    public function getSkippedCount(): int
    {
        return $this->skippedCount;
    }
    /**
     * Devices left out because the project has not enabled their push service.
     *
     * @param int $skippedCount
     *
     * @return self
     */
    public function setSkippedCount(int $skippedCount): self
    {
        $this->initialized['skippedCount'] = true;
        $this->skippedCount = $skippedCount;
        return $this;
    }
    /**
     * The `Idempotency-Key` header the send was made with; null without one.
     *
     * @return string|null
     */
    public function getIdempotencyKey(): ?string
    {
        return $this->idempotencyKey;
    }
    /**
     * The `Idempotency-Key` header the send was made with; null without one.
     *
     * @param string|null $idempotencyKey
     *
     * @return self
     */
    public function setIdempotencyKey(?string $idempotencyKey): self
    {
        $this->initialized['idempotencyKey'] = true;
        $this->idempotencyKey = $idempotencyKey;
        return $this;
    }
    /**
     * When the push notification was sent, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the push notification was sent, as an ISO 8601 timestamp.
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
    /**
     * When every delivery settled, as an ISO 8601 timestamp; null while deliveries continue.
     *
     * @return string|null
     */
    public function getCompletedAt(): ?string
    {
        return $this->completedAt;
    }
    /**
     * When every delivery settled, as an ISO 8601 timestamp; null while deliveries continue.
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
}