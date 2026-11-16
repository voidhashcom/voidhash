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
     * The attempt's id, `wh_att_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * Which attempt this was, counted from 1.
     *
     * @var int
     */
    protected $attemptNumber;
    /**
     * Whether the webhook answered with a 2xx status.
     *
     * @var bool
     */
    protected $isSuccessful;
    /**
     * The HTTP status the webhook answered with; null when it could not be reached.
     *
     * @var int|null
     */
    protected $statusCode;
    /**
     * The start of the webhook's response body, up to 2,048 characters; null when there was none.
     *
     * @var string|null
     */
    protected $responseBody;
    /**
     * Why the webhook could not be reached; null when it answered.
     *
     * @var string|null
     */
    protected $errorMessage;
    /**
     * How long the attempt took, in milliseconds.
     *
     * @var int|null
     */
    protected $durationMs;
    /**
     * When the attempt was made, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * The attempt's id, `wh_att_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The attempt's id, `wh_att_...`.
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
     * Which attempt this was, counted from 1.
     *
     * @return int
     */
    public function getAttemptNumber(): int
    {
        return $this->attemptNumber;
    }
    /**
     * Which attempt this was, counted from 1.
     *
     * @param int $attemptNumber
     *
     * @return self
     */
    public function setAttemptNumber(int $attemptNumber): self
    {
        $this->initialized['attemptNumber'] = true;
        $this->attemptNumber = $attemptNumber;
        return $this;
    }
    /**
     * Whether the webhook answered with a 2xx status.
     *
     * @return bool
     */
    public function getIsSuccessful(): bool
    {
        return $this->isSuccessful;
    }
    /**
     * Whether the webhook answered with a 2xx status.
     *
     * @param bool $isSuccessful
     *
     * @return self
     */
    public function setIsSuccessful(bool $isSuccessful): self
    {
        $this->initialized['isSuccessful'] = true;
        $this->isSuccessful = $isSuccessful;
        return $this;
    }
    /**
     * The HTTP status the webhook answered with; null when it could not be reached.
     *
     * @return int|null
     */
    public function getStatusCode(): ?int
    {
        return $this->statusCode;
    }
    /**
     * The HTTP status the webhook answered with; null when it could not be reached.
     *
     * @param int|null $statusCode
     *
     * @return self
     */
    public function setStatusCode(?int $statusCode): self
    {
        $this->initialized['statusCode'] = true;
        $this->statusCode = $statusCode;
        return $this;
    }
    /**
     * The start of the webhook's response body, up to 2,048 characters; null when there was none.
     *
     * @return string|null
     */
    public function getResponseBody(): ?string
    {
        return $this->responseBody;
    }
    /**
     * The start of the webhook's response body, up to 2,048 characters; null when there was none.
     *
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
     * Why the webhook could not be reached; null when it answered.
     *
     * @return string|null
     */
    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }
    /**
     * Why the webhook could not be reached; null when it answered.
     *
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
     * How long the attempt took, in milliseconds.
     *
     * @return int|null
     */
    public function getDurationMs(): ?int
    {
        return $this->durationMs;
    }
    /**
     * How long the attempt took, in milliseconds.
     *
     * @param int|null $durationMs
     *
     * @return self
     */
    public function setDurationMs(?int $durationMs): self
    {
        $this->initialized['durationMs'] = true;
        $this->durationMs = $durationMs;
        return $this;
    }
    /**
     * When the attempt was made, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the attempt was made, as an ISO 8601 timestamp.
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
}