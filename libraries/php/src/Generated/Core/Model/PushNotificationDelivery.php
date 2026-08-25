<?php

namespace Voidhash\Generated\Core\Model;

class PushNotificationDelivery
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
     * @var string|null
     */
    protected $completedAt;
    /**
     * @var string
     */
    protected $createdAt;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var string|null
     */
    protected $lastError;
    /**
     * @var mixed
     */
    protected $maxAttempts;
    /**
     * @var string|null
     */
    protected $nextAttemptAt;
    /**
     * @var string
     */
    protected $personId;
    /**
     * @var string
     */
    protected $provider;
    /**
     * @var string|null
     */
    protected $providerMessageId;
    /**
     * @var string
     */
    protected $status;
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
    public function getLastError(): ?string
    {
        return $this->lastError;
    }
    /**
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
     * @return string
     */
    public function getPersonId(): string
    {
        return $this->personId;
    }
    /**
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
     * @return string
     */
    public function getProvider(): string
    {
        return $this->provider;
    }
    /**
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
     * @return string|null
     */
    public function getProviderMessageId(): ?string
    {
        return $this->providerMessageId;
    }
    /**
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
}