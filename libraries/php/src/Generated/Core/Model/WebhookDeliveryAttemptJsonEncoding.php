<?php

namespace Voidhash\Generated\Core\Model;

class WebhookDeliveryAttemptJsonEncoding
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
    protected $attemptNumber;
    /**
     * @var string|null
     */
    protected $createdAt;
    /**
     * @var mixed|null
     */
    protected $durationMs;
    /**
     * @var string|null
     */
    protected $errorMessage;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var string|null
     */
    protected $responseBody;
    /**
     * @var mixed|null
     */
    protected $statusCode;
    /**
     * @var bool
     */
    protected $succeeded;
    /**
     * @return mixed
     */
    public function getAttemptNumber()
    {
        return $this->attemptNumber;
    }
    /**
     * @param mixed $attemptNumber
     *
     * @return self
     */
    public function setAttemptNumber($attemptNumber): self
    {
        $this->initialized['attemptNumber'] = true;
        $this->attemptNumber = $attemptNumber;
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
     * @return mixed
     */
    public function getDurationMs()
    {
        return $this->durationMs;
    }
    /**
     * @param mixed $durationMs
     *
     * @return self
     */
    public function setDurationMs($durationMs): self
    {
        $this->initialized['durationMs'] = true;
        $this->durationMs = $durationMs;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }
    /**
     * @param string|null $errorMessage
     *
     * @return self
     */
    public function setErrorMessage(?string $errorMessage): self
    {
        $this->initialized['errorMessage'] = true;
        $this->errorMessage = $errorMessage;
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
    public function getResponseBody(): ?string
    {
        return $this->responseBody;
    }
    /**
     * @param string|null $responseBody
     *
     * @return self
     */
    public function setResponseBody(?string $responseBody): self
    {
        $this->initialized['responseBody'] = true;
        $this->responseBody = $responseBody;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getStatusCode()
    {
        return $this->statusCode;
    }
    /**
     * @param mixed $statusCode
     *
     * @return self
     */
    public function setStatusCode($statusCode): self
    {
        $this->initialized['statusCode'] = true;
        $this->statusCode = $statusCode;
        return $this;
    }
    /**
     * @return bool
     */
    public function getSucceeded(): bool
    {
        return $this->succeeded;
    }
    /**
     * @param bool $succeeded
     *
     * @return self
     */
    public function setSucceeded(bool $succeeded): self
    {
        $this->initialized['succeeded'] = true;
        $this->succeeded = $succeeded;
        return $this;
    }
}