<?php

namespace Voidhash\Generated\Core\Model;

class PushNotificationSend
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
     * @var string|null
     */
    protected $completedAt;
    /**
     * @var string
     */
    protected $createdAt;
    /**
     * @var mixed
     */
    protected $deviceCount;
    /**
     * @var mixed
     */
    protected $failedCount;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var string|null
     */
    protected $idempotencyKey;
    /**
     * @var array<string, mixed>
     */
    protected $message;
    /**
     * @var bool
     */
    protected $messagePurged;
    /**
     * @var mixed
     */
    protected $requestedDistinctIdCount;
    /**
     * @var mixed
     */
    protected $requestedPersonCount;
    /**
     * @var mixed
     */
    protected $skippedCount;
    /**
     * @var string
     */
    protected $status;
    /**
     * @var mixed
     */
    protected $succeededCount;
    /**
     * @var list<string>
     */
    protected $unresolvedDistinctIds;
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
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
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
     * @return mixed
     */
    public function getDeviceCount()
    {
        return $this->deviceCount;
    }
    /**
     * @param mixed $deviceCount
     *
     * @return self
     */
    public function setDeviceCount($deviceCount): self
    {
        $this->initialized['deviceCount'] = true;
        $this->deviceCount = $deviceCount;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getFailedCount()
    {
        return $this->failedCount;
    }
    /**
     * @param mixed $failedCount
     *
     * @return self
     */
    public function setFailedCount($failedCount): self
    {
        $this->initialized['failedCount'] = true;
        $this->failedCount = $failedCount;
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
     * @return string|null
     */
    public function getIdempotencyKey(): ?string
    {
        return $this->idempotencyKey;
    }
    /**
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
     * @return array<string, mixed>
     */
    public function getMessage(): iterable
    {
        return $this->message;
    }
    /**
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
     * @return bool
     */
    public function getMessagePurged(): bool
    {
        return $this->messagePurged;
    }
    /**
     * @param bool $messagePurged
     *
     * @return self
     */
    public function setMessagePurged(bool $messagePurged): self
    {
        $this->initialized['messagePurged'] = true;
        $this->messagePurged = $messagePurged;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getRequestedDistinctIdCount()
    {
        return $this->requestedDistinctIdCount;
    }
    /**
     * @param mixed $requestedDistinctIdCount
     *
     * @return self
     */
    public function setRequestedDistinctIdCount($requestedDistinctIdCount): self
    {
        $this->initialized['requestedDistinctIdCount'] = true;
        $this->requestedDistinctIdCount = $requestedDistinctIdCount;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getRequestedPersonCount()
    {
        return $this->requestedPersonCount;
    }
    /**
     * @param mixed $requestedPersonCount
     *
     * @return self
     */
    public function setRequestedPersonCount($requestedPersonCount): self
    {
        $this->initialized['requestedPersonCount'] = true;
        $this->requestedPersonCount = $requestedPersonCount;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getSkippedCount()
    {
        return $this->skippedCount;
    }
    /**
     * @param mixed $skippedCount
     *
     * @return self
     */
    public function setSkippedCount($skippedCount): self
    {
        $this->initialized['skippedCount'] = true;
        $this->skippedCount = $skippedCount;
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
     * @return mixed
     */
    public function getSucceededCount()
    {
        return $this->succeededCount;
    }
    /**
     * @param mixed $succeededCount
     *
     * @return self
     */
    public function setSucceededCount($succeededCount): self
    {
        $this->initialized['succeededCount'] = true;
        $this->succeededCount = $succeededCount;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getUnresolvedDistinctIds(): array
    {
        return $this->unresolvedDistinctIds;
    }
    /**
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
}